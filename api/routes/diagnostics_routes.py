from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from src.report_generator import generate_medical_report
from typing import List
import os
import shutil
from datetime import datetime
import base64
from io import BytesIO
from .. import schemas, database, models, auth
# src.batch_processing and src.gradcam_utils are loaded lazily below
# because they transitively import TensorFlow at the top level.
router = APIRouter()

# --- Config ---
UPLOAD_DIR = "uploads"
HEATMAP_DIR = "heatmaps"
MODEL_PATH = "models/breast_cancer_model_best.keras"

# Lazy-load model to prevent massive RAM usage on startup
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from tensorflow.keras.models import load_model  # lazy import — TF not required on startup
            _model = load_model(MODEL_PATH)
        except Exception as e:
            print(f"Warning: Could not load model at {MODEL_PATH}. {e}")
    return _model

@router.post("/patients/{patient_id}/images", response_model=schemas.ImageRecordResponse)
async def upload_image(
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    # 1. Verify patient ownership
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient or patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=404, detail="Patient not found or access denied")
    
    # 2. Check maximum images (limit to 5)
    current_images = db.query(models.ImageRecord).filter(models.ImageRecord.patient_id == patient_id).count()
    if current_images >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed per patient")

    # 2.5 Validate Image
    from io import BytesIO
    from PIL import Image
    from src.image_validator import validate_histopathology_image
    
    try:
        img_bytes = await file.read()
        pil_img = Image.open(BytesIO(img_bytes))
        
        validation = validate_histopathology_image(pil_img)
        if not validation["is_valid"]:
            raise HTTPException(status_code=400, detail=validation["message"])
            
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="Invalid image format or corrupt file.")

    # 3. Save file locally
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"patient_{patient_id}_{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(img_bytes)
        
    # 4. Create database record
    db_image = models.ImageRecord(
        patient_id=patient_id,
        file_path=file_path,
        status="PENDING"
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    
    return db_image

@router.get("/images/{image_id}/file")
async def get_image_file(
    image_id: int, 
    token: str, 
    db: Session = Depends(database.get_db)
):
    from ..auth import SECRET_KEY, ALGORITHM
    from jose import JWTError, jwt
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
             raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
         raise HTTPException(status_code=401, detail="Invalid token")
         
    img = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not img or not os.path.exists(img.file_path):
         raise HTTPException(status_code=404, detail="Original image file not found")
         
    from fastapi.responses import FileResponse
    return FileResponse(img.file_path)

# --- Background Task Worker ---
def process_patient_diagnostics(patient_id: int):
    """
    This function runs in the background. It analyzes all PENDING images
    for a patient, updates their records, and generates an aggregated report.
    """
    from ..database import SessionLocal
    db = SessionLocal()
    
    try:
        # 1. Fetch ALL images for this patient to ensure aggregate syncing
        images = db.query(models.ImageRecord).filter(
            models.ImageRecord.patient_id == patient_id
        ).all()
        
        if not images:
            return
            
        if images:
            model = get_model()
            if not model:
                print(f"[ERROR] Background Task: Failed to load ML model for patient {patient_id}")
                for img in images:
                    img.status = "ERROR"
                    img.error_message = "ML Model not loaded."
                
                # Update report status as well
                report = db.query(models.Report).filter(
                    models.Report.patient_id == patient_id,
                    models.Report.status.in_(["PENDING", "GENERATING"])
                ).first()
                if report:
                    report.status = "ERROR"
                
                db.commit()
                return

            from src.batch_processing import BatchAnalyzer  # lazy: avoids TF import at startup
            analyzer = BatchAnalyzer(model)
            image_paths = [img.file_path for img in images]
        
            # 2. Run batch analysis
            batch_results = analyzer.analyze_batch(image_paths)
            
            # 3. Update individual image records
            results_list = batch_results.get("results", [])
            # Create a mapping for quick lookup by file_path
            res_map = {r.get("file_name"): r for r in results_list}
            
            for i, img in enumerate(images):
                res = res_map.get(img.file_path)
                if res:
                    if res.get("status") == "error":
                        img.status = "ERROR"
                        img.error_message = res.get("error_msg", "Unknown error")
                    else:
                        img.prediction_score = float(res.get("raw_pred", 0.0))
                        img.prediction_label = res.get("label", "UNKNOWN")
                        img.status = "PROCESSED"
                        img.error_message = None # Clear previous errors
                        
                        # Store heatmap/figure if available
                        figure = res.get("figure")
                        if figure:
                            buf = BytesIO()
                            figure.save(buf, format="PNG")
                            img.heatmap_base64 = base64.b64encode(buf.getvalue()).decode()
    
                        tumor_res = res.get("tumor_result")
                        if tumor_res and tumor_res.get("tumor_box_image"):
                            buf = BytesIO()
                            tumor_res["tumor_box_image"].save(buf, format="PNG")
                            img.bounding_base64 = base64.b64encode(buf.getvalue()).decode()
                            
                        morph_res = res.get("morphology_result")
                        if morph_res:
                            import json
                            # Save numerical stats
                            stats = {k: v for k, v in morph_res.items() if k != "annotated_image"}
                            img.morphology_json = json.dumps(stats)
                            
                            # Save visual
                            annot_img = morph_res.get("annotated_image")
                            if annot_img:
                                buf = BytesIO()
                                annot_img.save(buf, format="PNG")
                                img.morphology_img_base64 = base64.b64encode(buf.getvalue()).decode()
            
        # 4. Generate the final aggregated report
        # We find ANY pending/generating report for this patient
        report = db.query(models.Report).filter(
            models.Report.patient_id == patient_id,
            models.Report.status.in_(["PENDING", "GENERATING"])
        ).first()
        
        if not report:
            print(f"[INFO] Background Task: No pending report record found for patient {patient_id}, creating one.")
            report = models.Report(patient_id=patient_id, status="GENERATING")
            db.add(report)
        else:
            report.status = "GENERATING"
            
        db.commit()
        print(f"[INFO] Background Task: Analyzing aggregated metrics for patient {patient_id}")
        
        # Summary metrics - Fetch ALL processed images for accurate aggregation
        all_processed = db.query(models.ImageRecord).filter(
            models.ImageRecord.patient_id == patient_id,
            models.ImageRecord.status == "PROCESSED"
        ).all()
        if all_processed:
            malignant_count = sum(1 for i in all_processed if i.prediction_label == "MALIGNANT")
            benign_count = len(all_processed) - malignant_count
            
            final_pred = "MALIGNANT" if malignant_count > benign_count else "BENIGN"
            
            # Simple average of the *malignancy* score
            avg_conf = sum(i.prediction_score for i in all_processed) / len(all_processed)
            
            report.overall_prediction = final_pred
            report.avg_confidence = avg_conf
            
            # Call NVIDIA Gemma for Consolidated Report
            try:
                import requests
                
                system_prompt = (
                    "You are a clinical AI diagnostic assistant supporting pathologists. "
                    "Generate a detailed Automated Consolidated Pathology Report. "
                    "CRITICAL: Return the response STRICTLY as valid HTML. Use tags like <div>, <h3>, <p>, <ul>, <li>, <b>, <hr>. "
                    "DO NOT use Markdown (no asterisks **, no hashes #). "
                    "Structure the report layout with:\n"
                    "1. A 3-line summary paragraph in SIMPLE, NON-MEDICAL language so a normal human can understand easily.\n"
                    "2. Itemized breakdowns using bulleted elements (<ul><li>)."
                )

                from datetime import datetime
                patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
                doctor_name = "N/A"
                if patient and patient.doctor_id:
                    db_doctor = db.query(models.Doctor).filter(models.Doctor.id == patient.doctor_id).first()
                    if db_doctor:
                        doctor_name = db_doctor.name or db_doctor.email

                # 1. Build Individual Scan Breakdown Context
                scans_details = []
                import json
                for img in all_processed:
                    m_data = {}
                    if img.morphology_json:
                        try:
                            m_data = json.loads(img.morphology_json)
                        except: pass
                    scans_details.append(
                        f"Scan ID #{img.id}:\n"
                        f"  - Prediction: {img.prediction_label}\n"
                        f"  - Score: {img.prediction_score:.4f}\n"
                        f"  - Nuclei Count: {m_data.get('cell_count', 0)}\n"
                        f"  - Irregular Nuclei Ratio: {((m_data.get('irregular_nuclei_ratio', 0.0))*100):.1f}%\n"
                        f"  - Formed Clusters: {m_data.get('cluster_count', 0)}"
                    )
                scans_summary = "\n\n".join(scans_details)

                user_prompt = (
                    f"Report Metadata:\n"
                    f"- Patient Name: {patient.name if patient else 'Unnamed/Missing'}\n"
                    f"- Patient ID: #{patient_id}\n"
                    f"- Date of Report: {datetime.now().strftime('%Y-%m-%d')}\n"
                    f"- Referring Physician: {doctor_name}\n"
                    f"- Pathologist: AI Diagnostic Assistant\n\n"
                    f"Consolidated Diagnostics Datasets:\n"
                    f"- Aggregate Diagnosis: {final_pred}\n"
                    f"- Model Confidence: {avg_conf*100:.1f}%\n"
                    f"- Total Scans: {len(all_processed)}\n"
                    f"- Malignant: {malignant_count}\n"
                    f"- Benign: {benign_count}\n\n"
                    f"Individual Scan Breakdowns:\n"
                    f"{scans_summary}\n\n"
                    f"Please generate the Consolidated Clinical Report summarization now. "
                    f"Rely SPECIFICALLY on the provided Individual Scan Breakdowns above to describe morphological trends. "
                    f"DO NOT write general template text or insert placeholders."
                )

                invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
                headers = {
                    "Authorization": "Bearer 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",
                    "Content-Type": "application/json"
                }

                payload = {
                    "model": "google/gemma-3n-e4b-it",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": 512,
                    "temperature": 0.20,
                    "top_p": 0.70,
                    "stream": False
                }

                r = requests.post(invoke_url, json=payload, headers=headers, timeout=60)
                if r.status_code == 200:
                    res_json = r.json()
                    ai_text = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                    print(f"[SUCCESS] Background Task: NVIDIA LLM generated report for patient {patient_id}")
                    
                    report.llm_analysis_markdown = f"""<div>
  <h3>Automated Consolidated Pathology Report</h3>
  <p><b>Final Diagnosis:</b> {final_pred} (Confidence: {avg_conf*100:.1f}%)</p>
  <p><b>Specimens Analyzed:</b> {len(all_processed)}</p>
  <p><b>Malignant/Benign Ratio:</b> {malignant_count} Malignant | {benign_count} Benign</p>
  <hr />
  {ai_text}
</div>"""
                else:
                    print(f"[ERROR] Background Task: NVIDIA API returned {r.status_code}: {r.text}")
                    raise Exception(f"Nvidia API returned status {r.status_code}")
                    
            except Exception as llm_err:
                print(f"[WARNING] Background Task: LLM generation failed for patient {patient_id}: {llm_err}")
                # Fallback to structural setup
                report.llm_analysis_markdown = f"""
## Automated Consolidated Pathology Report
**Final Diagnosis:** {final_pred} (Confidence: {avg_conf*100:.1f}%)
**Specimens Analyzed:** {len(all_processed)}
**Malignant Regions Detected:** {malignant_count}
**Benign Regions Detected:** {benign_count}

---
*Detailed AI reasoning (Gemma-3B) momentarily unavailable. Core diagnostics preserved above.*
"""
            report.status = "COMPLETED"
        else:
            report.status = "ERROR"
            
        db.commit()
            
    except Exception as e:
        import traceback
        print(f"Background task failed: {e}")
        traceback.print_exc()
        
        # Mark everything as error
        for img in images:
            img.status = "ERROR"
            img.error_message = str(e)
            
        # Also mark the report as error if we can find it
        report = db.query(models.Report).filter(
            models.Report.patient_id == patient_id,
            models.Report.status.in_(["PENDING", "GENERATING"])
        ).first()
        if report:
            report.status = "ERROR"
            
        db.commit()
    finally:
        db.close()


@router.post("/patients/{patient_id}/generate", response_model=schemas.ReportResponse)
async def start_generation(
    patient_id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    """
    Trigger the background processing for all pending images for this patient.
    Instantly returns a "Job Started" response.
    """
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient or patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=404, detail="Patient not found or access denied")
        
    # Process all available images for this patient to ensure full fixes sync
        
    # Create the pending report record if one doesn't already exist
    existing_report = db.query(models.Report).filter(
        models.Report.patient_id == patient_id,
        models.Report.status.in_(["PENDING", "GENERATING"])
    ).first()
    
    if not existing_report:
        report = models.Report(
            patient_id=patient_id,
            status="PENDING"
        )
        db.add(report)
        db.commit()
        db.refresh(report)
    else:
        report = existing_report
    
    # Queue up the heavy work
    background_tasks.add_task(process_patient_diagnostics, patient_id)
    
    return report

@router.post("/batch-generate")
async def start_batch_generation(
    req: schemas.BatchGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    """
    Trigger the background processing for multiple patients in bulk.
    """
    queued_count = 0
    # Process each patient provided in the bulk request
    for patient_id in req.patient_ids:
        patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
        
        # Skip if patient doesn't exist or belong to this doctor
        if not patient or patient.doctor_id != current_doctor.id:
            continue
            
        # Process all available images for this patient to ensure full fixes sync
            
        # Queue the job
        background_tasks.add_task(process_patient_diagnostics, patient_id)
        
        # Create a pending report
        report = models.Report(
            patient_id=patient_id,
            status="PENDING"
        )
        db.add(report)
        queued_count += 1
        
    db.commit()
    
    return {"message": f"Successfully queued {queued_count} patients for analysis."}


@router.get("/patients/{patient_id}/report/pdf")
async def download_patient_pdf_report(
    patient_id: int,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    """
    Generate and stream a standardized PDF Medical Report for a patient.
    Aggregates image analysis results and the LLM synthesis.
    """
    from PIL import Image
    import io
    
    # Verify patient ownership
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient or patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=404, detail="Patient not found or access denied")
        
    # Get the latest completed report
    report = db.query(models.Report).filter(
        models.Report.patient_id == patient_id,
        models.Report.status == "COMPLETED"
    ).order_by(models.Report.id.desc()).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="No completed report found for this patient")
        
    # Get all processed images to extract stats
    images = db.query(models.ImageRecord).filter(
        models.ImageRecord.patient_id == patient_id,
        models.ImageRecord.status == "COMPLETED"
    ).all()
    
    # Construct the result dictionary expected by report_generator.py
    # Fallback/defaults
    result_dict = {
        'prediction': report.overall_prediction or "Unknown",
        'confidence': report.avg_confidence or 0.0,
        'image_name': f"P-{patient.id:04d} Scans",
        'cell_count': 0,
        'cell_density': 0.0,
        'irregular_nuclei_ratio': 0.0,
        'cluster_count': 0,
        'largest_cluster': 0,
        'suspicion_level': "Unknown"
    }
    
    # Try to extract real morphology from the latest processed image
    import json
    for img in reversed(images):
        if img.morphology_json:
            try:
                m_data = json.loads(img.morphology_json)
                result_dict.update({
                    'cell_count': m_data.get('cell_count', 0),
                    'cell_density': m_data.get('cell_density', 0.0),
                    'irregular_nuclei_ratio': m_data.get('irregular_nuclei_ratio', 0.0),
                    'cluster_count': m_data.get('cluster_count', 0),
                    'largest_cluster': m_data.get('largest_cluster', 0),
                    'suspicion_level': m_data.get('suspicion_level', 'Unknown')
                })
                break # Found one, use it
            except Exception:
                pass
    
    heatmap_pil = None
    bounding_pil = None
    
    # Try to extract the first available heatmap and bounding box from the database
    # Since report_generator expects a PIL image, we decode the Base64
    for img in reversed(images): # Prefer the most recent
        if not heatmap_pil and img.heatmap_base64:
            try:
                heatmap_data = base64.b64decode(img.heatmap_base64)
                heatmap_pil = Image.open(io.BytesIO(heatmap_data))
            except Exception:
                pass
                
        if not bounding_pil and img.bounding_base64:
            try:
                bounding_data = base64.b64decode(img.bounding_base64)
                bounding_pil = Image.open(io.BytesIO(bounding_data))
            except Exception:
                pass
                
        if heatmap_pil and bounding_pil:
            break
            
    # Generate the PDF bytes
    pdf_bytes, status_msg = generate_medical_report(
        result_dict=result_dict,
        heatmap_img=heatmap_pil,
        tumor_img=bounding_pil
    )
    
    if pdf_bytes is None:
        raise HTTPException(status_code=500, detail=f"PDF Generation failed: {status_msg}")
        
    # Return as a streaming File response indicating it's a PDF download
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=GradVision_Report_{patient_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )


@router.post("/images/{image_id}/chat")
async def chat_about_image(
    image_id: int,
    query_body: dict,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    """
    Query NVIDIA's Gemma API about a specific scan, injecting local diagnostics weightings.
    """
    import requests
    from fastapi.responses import StreamingResponse

    # 1. Fetch Image metrics
    image = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Scan file not found")

    # 2. Verify ownership 
    patient = db.query(models.Patient).filter(models.Patient.id == image.patient_id).first()
    if not patient or patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 3. Formulate Prompt context
    label = image.prediction_label or "UNKNOWN"
    score = image.prediction_score or 0.0
    user_message = query_body.get("message", "")

    system_prompt = (
        "You are a clinical AI diagnostic assistant supporting pathologists. "
        "Answer concisely. Provide rigid morphological speculation but NEVER diagnose definitively."
    )

    context_prompt = (
        f"Case/Scan Context:\n"
        f"- Prediction: {label}\n"
        f"- Confidence Score: {score:.4f}\n"
        f"- Patient: ID #{patient.id}\n\n"
        f"Clinician Question: {user_message}"
    )

    # 4. NVIDIA Config
    invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer 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",
        "Accept": "text/event-stream"
    }

    payload = {
        "model": "google/gemma-3n-e4b-it",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context_prompt}
        ],
        "max_tokens": 512,
        "temperature": 0.20,
        "top_p": 0.70,
        "frequency_penalty": 0.00,
        "presence_penalty": 0.00,
        "stream": True
    }

    def generate():
        try:
            with requests.post(invoke_url, json=payload, headers=headers, stream=True, timeout=15) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        yield line + b"\n"
        except Exception as e:
            yield f"data: [Error communicating with Nvidia API: {str(e)}]\n\n".encode('utf-8')

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/patients/{patient_id}/chat")
async def chat_about_patient(
    patient_id: int,
    query_body: dict,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    """
    Query NVIDIA's Gemma API about a patient's entire aggregated diagnostics dataset.
    """
    import requests
    from fastapi.responses import StreamingResponse

    # 1. Verify Patient Ownership
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient or patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 2. Fetch Processed Scans for Context
    images = db.query(models.ImageRecord).filter(
        models.ImageRecord.patient_id == patient_id,
        models.ImageRecord.status == "PROCESSED"
    ).all()

    report = db.query(models.Report).filter(
        models.Report.patient_id == patient_id,
        models.Report.status == "COMPLETED"
    ).order_by(models.Report.id.desc()).first()

    # 3. Formulate Summary Context
    scans_text = "\n".join([
        f"- Scan ID #{img.id}: {img.prediction_label} (Malignancy Confidence: {img.prediction_score:.4f})"
        for img in images
    ]) if images else "No processed scans found."

    agg_text = (
        f"Aggregated Profile Assessment:\n"
        f"- Overall Prediction: {report.overall_prediction if report else 'None'}\n"
        f"- Average Confidence: {report.avg_confidence*100:.1f}%" if report else "- No aggregated summary generated yet."
    )

    user_message = query_body.get("message", "")

    system_prompt = (
        "You are a clinical AI diagnostic assistant supporting pathologists. "
        "You are reviewing a CONSOLIDATED dashboard for a patient encompassing MULTIPLE scans. "
        "Answer concisely and synthesize findings across the dataset. Provide speculative comparative insights across scans, but NEVER diagnose definitively."
    )

    context_prompt = (
        f"Consolidated Patient Data (Patient ID #{patient_id}):\n"
        f"--------------------------------------------------\n"
        f"{scans_text}\n\n"
        f"{agg_text}\n"
        f"--------------------------------------------------\n\n"
        f"Clinician Question: {user_message}"
    )

    # 4. NVIDIA Config
    invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer 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",
        "Accept": "text/event-stream"
    }

    payload = {
        "model": "google/gemma-3n-e4b-it",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context_prompt}
        ],
        "max_tokens": 768,
        "temperature": 0.20,
        "top_p": 0.70,
        "frequency_penalty": 0.00,
        "presence_penalty": 0.00,
        "stream": True
    }

    def generate_patient_stream():
        try:
            with requests.post(invoke_url, json=payload, headers=headers, stream=True, timeout=20) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        yield line + b"\n"
        except Exception as e:
            yield f"data: [Error communicates with Nvidia API: {str(e)}]\n\n".encode('utf-8')

    return StreamingResponse(generate_patient_stream(), media_type="text/event-stream")

@router.delete("/images/{image_id}", status_code=204)
async def delete_image(
    image_id: int, 
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    img = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not img:
         raise HTTPException(status_code=404, detail="Image not found")
         
    patient = db.query(models.Patient).filter(models.Patient.id == img.patient_id).first()
    if patient.doctor_id != current_doctor.id:
         raise HTTPException(status_code=403, detail="Not authorized to delete this image")
         
    import os
    if img.file_path and os.path.exists(img.file_path):
        try: os.remove(img.file_path)
        except: pass
        
    db.delete(img)
    db.commit()
    return

