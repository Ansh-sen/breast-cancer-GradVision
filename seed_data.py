from api.database import SessionLocal
from api.models import Doctor, Patient
from api.auth import get_password_hash

def seed_demo_data():
    db = SessionLocal()
    
    # 1. Create a Demo Doctor
    demo_email = "doctor@demo.com"
    demo_password = "password123"
    
    # Check if doctor already exists
    doctor = db.query(Doctor).filter(Doctor.email == demo_email).first()
    
    if not doctor:
        print(f"Creating demo doctor account (Email: {demo_email}, Password: {demo_password})...")
        doctor = Doctor(
            name="Gregory House",
            email=demo_email,
            department="Diagnostic Pathology",
            hashed_password=get_password_hash(demo_password)
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)
        print("Demo doctor created!")
    else:
        print("Demo doctor already exists.")

    # 2. Create Demo Patients for this Doctor
    patients_to_add = [
        {"name": "Sarah Jenkins", "age": 45, "sex": "Female"},
        {"name": "Eleanor Vance", "age": 62, "sex": "Female"},
        {"name": "Michael Reed", "age": 58, "sex": "Male"} 
    ]
    
    added_patients = 0
    for pat_data in patients_to_add:
        # Check if patient exists for this doctor
        existing_pat = db.query(Patient).filter(
            Patient.doctor_id == doctor.id, 
            Patient.name == pat_data["name"]
        ).first()
        
        if not existing_pat:
            new_patient = Patient(
                doctor_id=doctor.id,
                name=pat_data["name"],
                age=pat_data["age"],
                sex=pat_data["sex"]
            )
            db.add(new_patient)
            added_patients += 1
            
    if added_patients > 0:
        db.commit()
        print(f"Added {added_patients} demo patients to Dr. {doctor.name}'s roster!")
    else:
        print("Demo patients already exist.")
        
    db.close()
    
if __name__ == "__main__":
    seed_demo_data()
