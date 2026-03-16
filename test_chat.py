import requests

def test_chat():
    # We need a valid token. Let's try to login as a doctor.
    # From previous files, login endpoint is usually /api/v1/auth/login or similar
    # auth_routes.router at /api/v1/auth
    login_url = "http://localhost:8000/api/v1/auth/login"
    
    # Let's try to just hit the chat endpoint. 
    # If it is 401, we know it's hit but requires auth.
    chat_url = "http://localhost:8000/api/v1/diagnostics/images/1/chat"
    
    print("Testing unauthorized POST to chat...")
    try:
        r = requests.post(chat_url, json={"message": "hello"}, timeout=10)
        print(f"Status: {r.status_code}")
        print(f"Content: {r.text[:200]}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_chat()
