#!/usr/bin/env python3
import pymysql
import sys

# XAMPP Defaults
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = "" # Default XAMPP has no root password
DB_NAME = "gradvision"

def init_database():
    print(f"Connecting to MySQL on {DB_HOST} as '{DB_USER}'...")
    try:
        # Connect to MySQL (without selecting a DB so we can create it)
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
        )
        
        with connection.cursor() as cursor:
            # Create database if it doesn't exist
            print(f"Creating database '{DB_NAME}' if it does not exist...")
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME};")
            print("Database created or already exists!")
            
        connection.commit()
    except Exception as e:
        print(f"Error connecting to MySQL: {e}")
        print("Please ensure XAMPP MySQL is running.")
        sys.exit(1)
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()
            
    # Now use SQLAlchemy to create tables
    print("\nCreating tables using SQLAlchemy...")
    try:
        from api.database import engine
        from api.models import Base
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully!")
    except ImportError as e:
        print(f"Error importing modules: {e}")
        print("Make sure you are running this from the project root directory")
        sys.exit(1)
    except Exception as e:
        print(f"Error creating tables: {e}")
        sys.exit(1)

    print("\nDatabase initialization complete! You can now run the API with:")
    print("uvicorn api.main:app --reload")

if __name__ == "__main__":
    init_database()
