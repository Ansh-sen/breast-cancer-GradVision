from api import database
from sqlalchemy import text
db = database.SessionLocal()
try:
    res = db.execute(text("DESCRIBE images"))
    columns = [r[0] for r in res]
    print("Columns in 'images' table:")
    for c in columns:
        print(f" - {c}")
except Exception as e:
    print(f"Error describing table: {e}")
finally:
    db.close()
