from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patients = relationship("Patient", back_populates="doctor")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    name = Column(String(255), nullable=False)
    age = Column(Integer)
    sex = Column(String(10))
    # You can add more demographic/clinical fields here easily (e.g., brca_status, bi_rads)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("Doctor", back_populates="patients")
    images = relationship("ImageRecord", back_populates="patient", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="patient", cascade="all, delete-orphan")

class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    file_path = Column(String(500), nullable=False)  # Path to original image uploaded
    heatmap_path = Column(String(500), nullable=True) # Path to generated Grad-CAM heatmap
    heatmap_base64 = Column(Text(4294967295), nullable=True) # Base64 string of Grad-CAM heatmap
    bounding_base64 = Column(Text(4294967295), nullable=True) # Base64 string of Tumor Localization
    morphology_json = Column(Text, nullable=True) # JSON string of numerical metrics
    morphology_img_base64 = Column(Text(4294967295), nullable=True) # Base64 string of annotated cells
    prediction_score = Column(Float, nullable=True) # e.g. 0.85
    prediction_label = Column(String(50), nullable=True) # "MALIGNANT" or "BENIGN"
    status = Column(String(50), default="PENDING") # PENDING, PROCESSED, ERROR
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    patient = relationship("Patient", back_populates="images")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    overall_prediction = Column(String(50), nullable=True) # Combined prediction based on all images
    avg_confidence = Column(Float, nullable=True)
    llm_analysis_markdown = Column(Text, nullable=True) # Full LLM text report
    status = Column(String(50), default="PENDING") # PENDING, GENERATING, COMPLETED, ERROR
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="reports")
