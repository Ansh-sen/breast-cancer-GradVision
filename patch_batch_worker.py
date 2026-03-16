import os, re

path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\api\routes\diagnostics_routes.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Find the PENDING fetch and abort
sub1_target = """        # 1. Fetch PENDING images
        images = db.query(models.ImageRecord).filter(
            models.ImageRecord.patient_id == patient_id,
            models.ImageRecord.status == "PENDING"
        ).all()
        
        if not images:
            return"""

sub1_replace = """        # 1. Fetch PENDING images
        images = db.query(models.ImageRecord).filter(
            models.ImageRecord.patient_id == patient_id,
            models.ImageRecord.status == "PENDING"
        ).all()
        
        has_processed = db.query(models.ImageRecord).filter(
            models.ImageRecord.patient_id == patient_id,
            models.ImageRecord.status == "PROCESSED"
        ).first() is not None

        if not images and not has_processed:
            return
            
        if images:"""

# 2. Find Step 4 and insert the IF block closure before it
sub2_target = """        # 4. Generate the final aggregated report"""
sub2_replace = """        # 4. Generate the final aggregated report"""

if sub1_target in content:
    content = content.replace(sub1_target, sub1_replace)
    print("Injected start wrapper.")
else:
    print("Could not find start wrapper.")

# We also need to add an indent to everything between Step 1 and Step 4, 
# OR just add the closing brace right before `report = db.query(...)` 
# with indentation if the indentation matches outer scope!
# Since Python STRICTLY enforces indentation, let's just use Python's index based insertion to add `        if images:` and then add backspace indent at Step 4!
# Indentation alignment: Step 4 falls at 8 spaces like `        # 4. Generate...`
# So we need `        # 4. Generate` to be preceded by a closing indent layer from `if images:` ?
# Actually adding a blanket `        if images:` requires adding 4 spaces to ALL lines in between!
# This is around 50 lines. Let's do it cleanly!

# Let's find index between Step 1 (`if images:`) and Step 4
start_match = re.search(r'import BatchAnalyzer\n\s+image_paths = \[img\.file_path for img in images\]', content)

lines = content.split('\n')
indented_lines = []
in_section = False

for line in lines:
    if "analyzer = BatchAnalyzer(model)" in line:
        indented_lines.append("        if images:")
        in_section = True
    if "# 4. Generate the final aggregated report" in line:
        in_section = False
        
    if in_section and not "if images:" in line:
        indented_lines.append("    " + line) # Add 4 spaces
    else:
        indented_lines.append(line)

final_content = '\n'.join(indented_lines)

with open(path, "w", encoding="utf-8") as f:
    f.write(final_content)
print("Safe indent patch written.")
f = open("patched_out_confirm.txt", "w")
f.write("Done")
f.close()
