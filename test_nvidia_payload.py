import requests

def test():
    system_prompt = (
        "You are a clinical AI diagnostic assistant supporting pathologists. "
        "Generate a detailed Automated Consolidated Pathology Report based on the provided aggregated metrics. "
    )

    user_prompt = (
        f"Consolidated Diagnostics Datasets:\n"
        f"- Aggregate Diagnosis: MALIGNANT\n"
        f"- Model Confidence: 90.0%\n"
        f"- Total Scans: 1\n\n"
        f"Please generate the Consolidated Clinical Report summarization now."
    )

    invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": "Bearer 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",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "google/gemma-3n-e4b-it",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 512,
        "temperature": 0.20,
        "top_p": 0.70,
        "stream": True
    }

    try:
        r = requests.post(invoke_url, json=payload, headers=headers, timeout=20, stream=True)
        print(f"Status Code: {r.status_code}")
        for line in r.iter_lines():
            if line:
                print(line.decode('utf-8'))
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test()
