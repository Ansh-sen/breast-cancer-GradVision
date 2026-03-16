import pymysql

def check_images():
    try:
        conn = pymysql.connect(host='localhost', user='root', password='', database='gradvision')
        cursor = conn.cursor()
        cursor.execute("SELECT id, status, LENGTH(bounding_base64) as b_len, SUBSTRING(bounding_base64, 1, 30) as b_head FROM images")
        rows = cursor.fetchall()
        print("--- MySQL Image Records ---")
        for r in rows:
            print(f"Image ID: {r[0]} | Status: {r[1]} | Bounding Length: {r[2]} | Header: {r[3]}")
    except Exception as e:
        print(f"Error reading MySQL DB: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == '__main__':
    check_images()
