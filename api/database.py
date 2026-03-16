from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Assuming local XAMPP MySQL setup. 
# You might need to change 'root:password' below based on your XAMPP config.
# If XAMPP root user has no password, use: mysql+pymysql://root@localhost/gradvision
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root@localhost/gradvision"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
