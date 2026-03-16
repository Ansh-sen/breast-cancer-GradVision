from api import database
from sqlalchemy import text
db = database.SessionLocal()
try:
    print("Altering table 'images'...")
    db.execute(text("ALTER TABLE images ADD COLUMN morphology_json TEXT"))
    db.execute(text("ALTER TABLE images ADD COLUMN morphology_img_base64 LONGTEXT"))
    db.commit()
    print("Columns added successfully!")
except Exception as e:
    db.rollback()
    print(f"Error altering table: {e}")
finally:
    db.close()
