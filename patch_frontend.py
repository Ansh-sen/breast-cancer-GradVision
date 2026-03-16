import os

path = r"d:\Extra Project\Ansh Sen\breast cancer detection project\frontend-react\src\pages\PatientPage.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                                        <MorphologyPanel images={images} />
                                    </div>"""

# Let's search loosely
import re
pattern = r'(<MorphologyPanel\s+images=\{images\}\s+/>\s*</div>)'

chat_widget = """<MorphologyPanel images={images} />

                                        {/* Aggregated Patient Clinician Support Desk */}
                                        <div className="card">
                                            <div className="card-header">
                                                <div><div className="card-title">💬 Patient Support Desk (Aggregated)</div><div className="card-subtitle">Consult NVIDIA Gemma about the entire specimen profile</div></div>
                                            </div>
                                            <div className="card-body" style={{ padding: '0px' }}>
                                                <div style={{ height: '240px', overflowY: 'auto', padding: '1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                                    {!(chatHistory["patient"] || []).length && (
                                                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                                                            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>💬</div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>No messages yet</div>
                                                            <div style={{ fontSize: '0.7rem' }}>Ask an AI assistant questions regarding the consolidate ratio trends OR scan breakdowns for this patient!</div>
                                                        </div>
                                                    )}
                                                    {(chatHistory["patient"] || []).map((msg, i) => (
                                                        <div key={i} style={{ marginBottom: '1rem', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                                                            <div style={{ display: 'inline-block', maxWidth: '85%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: msg.role === 'user' ? 'var(--brand-500)' : 'var(--bg-primary)', color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', border: msg.role === 'user' ? 'none' : '1px solid var(--border)', fontSize: '0.825rem', lineHeight: 1.5, wordBreak: 'break-word', textAlign: 'left' }}>
                                                                {msg.content}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {chatLoading && (
                                                        <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                                                            <div style={{ display: 'inline-block', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: '0.825rem' }}>
                                                                <span className="pulse">typing...</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <form onSubmit={(e) => { e.preventDefault(); sendPatientMessage(); }} style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                                    <input type="text" placeholder="Query NVIDIA Gemma about this patient profile..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.825rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} disabled={chatLoading} />
                                                    <button type="submit" className="btn btn-primary btn-sm" disabled={chatLoading || !chatInput.trim()}>Send</button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>"""

new_content, count = re.subn(pattern, chat_widget, content)

if count > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Successfully replaced {count} occurrence(s).")
else:
    print("Failed to find target using regex.")
