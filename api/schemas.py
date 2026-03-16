from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- Doctor Schemas ---
class DoctorBase(BaseModel):
    email: EmailStr
    name: str
    department: Optional[str] = None

class DoctorCreate(DoctorBase):
    password: str

class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Image Schemas ---
class ImageRecordBase(BaseModel):
    file_path: str
    prediction_score: Optional[float] = None
    prediction_label: Optional[str] = None
    status: str
    error_message: Optional[str] = None

class ImageRecordResponse(ImageRecordBase):
    id: int
    heatmap_path: Optional[str] = None
    heatmap_base64: Optional[str] = None
    bounding_base64: Optional[str] = None
    morphology_json: Optional[str] = None
    morphology_img_base64: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ReportBase(BaseModel):
    overall_prediction: Optional[str] = None
    avg_confidence: Optional[float] = None
    status: str

class ReportResponse(ReportBase):
    id: int
    llm_analysis_markdown: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BatchGenerateRequest(BaseModel):
    patient_ids: List[int]

# --- Patient Schemas ---
class PatientBase(BaseModel):
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    id: int
    doctor_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Detailed patient view including nested images and reports
class PatientDetailResponse(PatientResponse):
    images: List[ImageRecordResponse] = []
    reports: List[ReportResponse] = []
