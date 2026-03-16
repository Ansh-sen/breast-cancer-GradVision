path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\frontend-react\src\pages\DashboardPage.jsx"

with open(path, 'rb') as f:
    data = f.read()

print(f"Raw File Size: {len(data)} bytes")

try:
    text = data.decode('utf-8')
    # Look for broken CLOSE tags or quoted closures
    if 'onClick={onClose">' in text:
        text = text.replace('onClick={onClose">', 'onClick={onClose}>')
        print("✓ Fixed 'onClick={onClose\">'")
    elif 'onClick={onClose"}' in text:
        text = text.replace('onClick={onClose"}', 'onClick={onClose}')
        print("✓ Fixed 'onClick={onClose\"}'")
    else:
        print("No immediate typos found using exact string templates.")

    # Save cleanly to strip any invalid byte headers
    with open(path, 'w', encoding='utf-8-sig') as f: # Use utf-8-sig if there was a BOM issue
        f.write(text)
    print("File rewritten with clean UTF-8 encoding.")

except Exception as e:
    print(f"Fix failed: {e}")
