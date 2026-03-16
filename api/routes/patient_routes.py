from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import csv
import io
from .. import schemas, database, models, auth

router = APIRouter()

@router.post("/", response_model=schemas.PatientResponse)
def create_patient(
    patient: schemas.PatientCreate, 
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    # Only authenticated doctors can create patients
    db_patient = models.Patient(**patient.dict(), doctor_id=current_doctor.id)
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.get("/", response_model=List[schemas.PatientDetailResponse])
def read_patients(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    # CRITICAL: Only return patients belonging to the logged-in doctor
    patients = db.query(models.Patient).filter(models.Patient.doctor_id == current_doctor.id).offset(skip).limit(limit).all()
    return patients

@router.get("/{patient_id}", response_model=schemas.PatientDetailResponse)
def read_patient(
    patient_id: int, 
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Ensure the doctor actually owns this patient
    if patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this patient's records")
        
    return patient

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int, 
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
         raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this patient")
        
    db.delete(patient)
    db.commit()
    return

@router.put("/{patient_id}", response_model=schemas.PatientResponse)
def update_patient(
    patient_id: int,
    patient_update: schemas.PatientCreate,
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    db_patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if db_patient.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this patient")
        
    db_patient.name = patient_update.name
    if patient_update.age is not None:
        db_patient.age = patient_update.age
    if patient_update.sex is not None:
        db_patient.sex = patient_update.sex
        
    db.commit()
    db.refresh(db_patient)
    return db_patient

@router.post("/import")
async def import_patients_csv(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_doctor: models.Doctor = Depends(auth.get_current_doctor)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Must upload a valid .csv file")
        
    contents = await file.read()
    try:
        decoded = contents.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Ensure the CSV is UTF-8 encoded")
        
    csv_reader = csv.DictReader(io.StringIO(decoded))
    
    # Validate headers roughly
    headers = [h.strip().lower() for h in (csv_reader.fieldnames or [])]
    if "name" not in headers:
        raise HTTPException(status_code=400, detail="CSV must contain at least a 'name' column")
        
    added_count = 0
    for row in csv_reader:
        # Clean dict keys to lowercase
        clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k and v}
        
        name = clean_row.get('name')
        if not name:
            continue
            
        age_str = clean_row.get('age', None)
        age = None
        if age_str and age_str.isdigit():
            age = int(age_str)
            
        sex = clean_row.get('sex', "Other")
        # Standardize sex
        if sex.lower() in ["f", "female"]: sex = "Female"
        elif sex.lower() in ["m", "male"]: sex = "Male"
        
        new_patient = models.Patient(
            name=name,
            age=age,
            sex=sex,
            doctor_id=current_doctor.id
        )
        db.add(new_patient)
        added_count += 1
        
    db.commit()
    return {"message": f"Successfully imported {added_count} patients."}
