import os

path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\api\routes\diagnostics_routes.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split('\n')
output_lines = []
skip_next_if_images = False

i = 0
while i < len(lines):
    line = lines[i]
    if "if images:" in line and i + 2 < len(lines) and "model = get_model()" in lines[i+2]:
        print(f"Found broken if images on line {i+1}")
        output_lines.append("        if images:")
        # Indent lines until the NEXT `if images:` or wherever
        i += 2 # Skip the empty line 118
        while i < len(lines):
            sub_line = lines[i]
            if "if images:" in sub_line:
                print(f"Found second if images on line {i+1}, merging.")
                # We can just skip this second `if images:` line
                i += 1 # Skip `if images:`
                # The lines following it are ALREADY indented by the previous script!
                # So we just break out of our manual indent loop and continue normal flow
                break
            # Add 4 spaces to lines 119 to 126
            if sub_line.strip():
                output_lines.append("    " + sub_line)
            else:
                output_lines.append(sub_line)
            i += 1
        continue
    output_lines.append(line)
    i += 1

final_content = '\n'.join(output_lines)

with open(path, "w", encoding="utf-8") as f:
    f.write(final_content)
    
print("Indentation fix applied.")
f = open("patched_indent_confirm.txt", "w")
f.write("Done")
f.close()
