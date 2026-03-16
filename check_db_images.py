import sqlite3

def check_images():
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, status, bounding_base64 IS NOT NULL as has_bounding FROM images")
        rows = cursor.fetchall()
        print("--- Image Database Records ---")
        for r in rows:
            print(f"Image ID: {r[0]} | Status: {r[1]} | Has Bounding Base64: {True if r[2] == 1 else False}")
    except Exception as e:
        print(f"Error reading DB: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    check_images()
