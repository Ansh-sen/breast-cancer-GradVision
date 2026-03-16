path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\frontend-react\src\pages\PatientPage.jsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace disabled trigger
target1 = "disabled={!hasPending || generating}"
replace1 = "disabled={images.length === 0 || generating}"

if target1 in content:
    content = content.replace(target1, replace1)
    print("✓ Replaced disabled trigger")
else:
    print("✗ Failed to find disabled trigger")

# 2. Replace image delete loop
# We search for the exact <div> block within the ScanCard div map
target2 = """                                                <div>
                                                    {img.status === 'PROCESSED' && ("""

replace2 = """                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {img.status === 'PROCESSED' && ("""

target3 = """                                                    {img.status === 'PENDING' && <span className="badge badge-orange" style={{ padding: '0.2rem 0.4rem' }}>⏳</span>}
                                                </div>"""

replace3 = """                                                    {img.status === 'PENDING' && <span className="badge badge-orange" style={{ padding: '0.2rem 0.4rem' }}>⏳</span>}
                                                    <button className="btn btn-ghost btn-xs" title="Delete Scan" style={{ color: 'var(--danger)', padding: '0.1rem 0.3rem', cursor: 'pointer' }} onClick={async e => {
                                                        e.stopPropagation();
                                                        if (confirm(`Permanently delete Scan #${img.id}?`)) {
                                                            await api.fetchAuth(`/diagnostics/images/${img.id}`, { method: 'DELETE' });
                                                            load();
                                                        }
                                                    }}>
                                                        🗑️
                                                    </button>
                                                </div>"""

if target2 in content and target3 in content:
    content = content.replace(target2, replace2)
    content = content.replace(target3, replace3)
    print("✓ Replaced delete image loop")
else:
    print("✗ Failed to find delete image loop targets")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
