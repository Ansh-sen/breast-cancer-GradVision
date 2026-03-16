from api import models, database
db = database.SessionLocal()
p = db.query(models.Patient).filter(models.Patient.id == 7).first()
if p:
    print(f"Patient 7 exists! Name: {p.name}, Doctor ID: {p.doctor_id}")
    d = db.query(models.Doctor).filter(models.Doctor.id == p.doctor_id).first()
    if d:
        print(f"Owned by: {d.name} ({d.email})")
else:
    print("Patient 7 does NOT exist in the database.")

doctors = db.query(models.Doctor).all()
print("\nAll Doctors:")
for doc in doctors:
    print(f"ID: {doc.id} | Name: {doc.name} | Email: {doc.email}")
db.close()
