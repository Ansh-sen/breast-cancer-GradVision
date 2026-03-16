import os, re

path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\api\routes\diagnostics_routes.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'(report\.llm_analysis_markdown\s*=\s*f"""##[^\n]*\n)(.*?)(?=\n\s*else:)'

def fix_indent(match):
    header = match.group(1)
    body = match.group(2)
    # Dedent all lines in the body
    fixed_body = "\n".join([line.lstrip() for line in body.split("\n")])
    # Combine back but ensuring absolute left alignment
    return header + fixed_body

new_content, count = re.subn(pattern, fix_indent, content, flags=re.DOTALL)

if count > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Successfully dedented {count} report layout sections.")
else:
    print("Failed to match report.llm_analysis_markdown pattern.")
