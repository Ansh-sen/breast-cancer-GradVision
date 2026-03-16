import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { marked } from 'marked';
import Sidebar from '../components/Sidebar';
import * as api from '../services/api';

// ---- XAI Modal ---- //
function XaiModal({ heatmap, bounding, morphology, onClose }) {
    const [tab, setTab] = useState(0);
    return (
        <div className="modal-backdrop open">
            <div className="modal-box modal-lg" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-head">
                    <div><div className="modal-title">XAI Analysis — Diagnostic Inspection</div><div className="modal-subtitle">Neural activation maps and cellular morphology</div></div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
                    <div className="tab-bar">
                        <button className={`tab-btn-ui${tab === 0 ? ' active' : ''}`} onClick={() => setTab(0)}>Grad-CAM Heatmap</button>
                        <button className={`tab-btn-ui${tab === 1 ? ' active' : ''}`} onClick={() => setTab(1)}>Tumor Localization</button>
                        <button className={`tab-btn-ui${tab === 2 ? ' active' : ''}`} onClick={() => setTab(2)}>Cell Morphology</button>
                    </div>
                </div>
                <div style={{ padding: '1rem 1.5rem 1.5rem', overflowY: 'auto', textAlign: 'center' }}>
                    {tab === 0 && (
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>🔴 HOT = Malignant activation &nbsp; 🔵 COOL = Normal tissue</div>
                            {heatmap ? <img src={heatmap} alt="Heatmap" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} /> : <div className="empty-state" style={{ padding: '2rem' }}><div className="empty-state-icon">🔥</div><div className="empty-state-text">No heatmap available</div></div>}
                        </div>
                    )}
                    {tab === 1 && (
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Bounding box overlay — threshold &gt; 0.6 confidence</div>
                            {bounding ? <img src={bounding} alt="Bounding box" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} /> : <div className="empty-state" style={{ padding: '2rem' }}><div className="empty-state-icon">🎯</div><div className="empty-state-text">No localization available</div></div>}
                        </div>
                    )}
                    {tab === 2 && (
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>🟢 Green = Regular nuclei &nbsp; 🔴 Red = Irregular nuclei</div>
                            {morphology ? <img src={morphology} alt="Cell Morphology" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} /> : <div className="empty-state" style={{ padding: '2rem' }}><div className="empty-state-icon">🔬</div><div className="empty-state-text">No morphology image available</div></div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---- Scan Card ---- //
function ScanCard({ img, onViewXai }) {
    let badgeEl, predColor = 'var(--text-muted)';
    if (img.status === 'PROCESSED') {
        const mal = img.prediction_label === 'MALIGNANT';
        badgeEl = <span className={`badge ${mal ? 'badge-red' : 'badge-green'}`}>{img.prediction_label}</span>;
        predColor = mal ? 'var(--danger)' : 'var(--success)';
    } else if (img.status === 'PENDING') {
        badgeEl = <span className="badge badge-orange"><span className="status-dot dot-orange dot-pulse" style={{ marginRight: 4 }} />Pending</span>;
    } else if (img.status === 'ERROR') {
        badgeEl = <span className="badge badge-red">Error</span>;
    }

    const hasXai = img.heatmap_base64 || img.bounding_base64 || img.morphology_img_base64;
    return (
        <div className="scan-item">
            <div className="scan-item-header">
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Scan #{img.id}</span>
                {badgeEl}
            </div>
            <div className="scan-item-body">
                <div className="scan-label">Prediction</div>
                <div className="scan-prediction" style={{ color: predColor }}>{img.prediction_label || '—'}</div>
                <div className="scan-confidence">
                    {img.prediction_score != null ? `${(img.prediction_score * 100).toFixed(1)}% confidence` : 'Not processed'}
                </div>
                {hasXai && (
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '0.625rem' }} onClick={() => onViewXai(img)}>
                        View AI Inspection →
                    </button>
                )}
            </div>
        </div>
    );
}

// ---- Report Block ---- //
function ReportPanel({ patient, onDownloadPdf }) {
    const reports = patient?.reports || [];
    if (!reports.length) return (
        <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No report yet</div>
            <div className="empty-state-text">Upload scans and run analysis to generate a report.</div>
        </div>
    );

    const latest = reports.reduce((a, b) => a.id > b.id ? a : b);
    if (latest.status === 'GENERATING' || latest.status === 'PENDING') return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', background: 'var(--warning-bg)', color: 'var(--warning)', marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                <div className="spinner spinner-sm" /> AI analysis in progress…
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Running in the background. Refresh in 30–90 seconds.
            </div>
        </div>
    );

    if (latest.status === 'ERROR') return (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600 }}>
            ⚠ Analysis encountered an error. Please retry.
        </div>
    );

    // COMPLETED
    const pred = latest.overall_prediction;
    const conf = latest.avg_confidence;
    return (
        <div>
            <style>{`
                .report-md { word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; overflow-x: auto; }
                .report-md h1, .report-md h2, .report-md h3 { color: var(--text-primary); margin-top: 1.25rem; margin-bottom: 0.5rem; font-weight: 700; }
                .report-md h1 { font-size: 1.2rem; } .report-md h2 { font-size: 1.1rem; } .report-md h3 { font-size: 1rem; }
                .report-md ul, .report-md ol { padding-left: 1.25rem; margin-bottom: 1rem; }
                .report-md li { margin-bottom: 0.35rem; line-height: 1.6; list-style-type: disc; color: var(--text-secondary); }
                .report-md p { margin-bottom: 0.75rem; line-height: 1.6; color: var(--text-secondary); font-size: 0.85rem; }
                .report-md strong { color: var(--text-primary); font-weight: 600; }
                .report-md table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.8rem; overflow-x: auto; display: block; }
                .report-md th, .report-md td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; }
                .report-md th { background: var(--bg-secondary); font-weight: 700; }
                .report-md hr { border: 0; border-top: 1px solid var(--border); margin: 1.25rem 0; }
            `}</style>
            <div className={`diagnosis-block ${pred === 'MALIGNANT' ? 'malignant' : 'benign'}`}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Primary Diagnosis</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{pred || 'Unknown'}</div>
                {conf != null && <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.8 }}>{(conf * 100).toFixed(1)}% model confidence</div>}
            </div>
            <hr className="divider" />
            <div className="report-md" dangerouslySetInnerHTML={{ __html: latest.llm_analysis_markdown || '<p><i>No detailed analysis available.</i></p>' }} />
        </div>
    );
}

// ---- Cell Morphology Panel ---- //
function MorphologyPanel({ images }) {
    // Locate the first available morphology result
    const validImg = images.find(img => img.morphology_json);
    if (!validImg) return null;

    let m = {};
    try {
        m = JSON.parse(validImg.morphology_json);
    } catch (e) {
        return null;
    }

    const susColors = { High: 'var(--danger)', Moderate: 'var(--warning)', Low: 'var(--success)', Unknown: 'var(--text-muted)' };
    const susColor = susColors[m.suspicion_level] || 'var(--text-muted)';

    return (
        <div className="card">
            <div className="card-header">
                <div><div className="card-title">Cell Morphology Analyzer</div><div className="card-subtitle">Biological Evidence &amp; Visual Metrics</div></div>
            </div>
            <div className="card-body">
                <div className="demographics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div className="demo-item"><div className="demo-label">Nuclei Count</div><div className="demo-value" style={{ fontSize: '1.1rem' }}>{m.cell_count || 0}</div></div>
                    <div className="demo-item"><div className="demo-label">Irregular Nuclei</div><div className="demo-value" style={{ fontSize: '1.1rem', color: m.irregular_nuclei_ratio > 0.3 ? 'var(--danger)' : 'inherit' }}>{((m.irregular_nuclei_ratio || 0) * 100).toFixed(1)}%</div></div>
                    <div className="demo-item"><div className="demo-label">Clusters</div><div className="demo-value" style={{ fontSize: '1.1rem' }}>{m.cluster_count || 0}</div></div>
                </div>
                <div style={{ marginTop: '1rem', padding: '0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SUSPICION LEVEL</div>
                    <div style={{ fontWeight: 800, color: susColor, fontSize: '0.85rem' }}>{m.suspicion_level?.toUpperCase() || '—'}</div>
                </div>
                {validImg.morphology_img_base64 && (
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <img src={`data:image/png;base64,${validImg.morphology_img_base64}`} alt="Annotated Cells" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ===========================  MAIN PAGE  =========================== //
export default function PatientPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [xaiImg, setXaiImg] = useState(null); // { heatmap, bounding }
    const [activeImgId, setActiveImgId] = useState(null);
    const [chatHistory, setChatHistory] = useState({}); // { [imgId]: [{role, content}] }
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const fileInputRef = useCallback(node => { if (node) node.value = ''; }, []);

    async function load() {
        const res = await api.getPatientDetail(id);
        if (res.ok) {
            const data = await res.json();
            setPatient(data);
            // Auto-poll if processing
            const latestRep = data.reports?.length ? data.reports.reduce((a, b) => a.id > b.id ? a : b) : null;
            if (latestRep?.status === 'GENERATING' || data.images?.some(i => i.status === 'PENDING' && !latestRep)) {
                // noop — user can manually refresh
            }
        } else {
            if (res.status === 403) {
                alert('Access Denied: You do not have permission to view this patient.');
            } else {
                const text = await res.text().catch(() => 'No detail');
                alert(`Patient not found (Status: ${res.status}). Details: ${text}`);
            }
            navigate('/');
        }
        setLoading(false);
    }

  useEffect(() => { load(); }, [id]);

  // Auto-polling for analysis logic
  useEffect(() => {
    let timer;
    const hasPend = patient?.images?.some(i => i.status === 'PENDING') || 
                    patient?.reports?.some(r => r.status === 'PENDING' || r.status === 'GENERATING');
    
    if (hasPend) {
      timer = setTimeout(load, 3000);
    }
    return () => timer && clearTimeout(timer);
  }, [patient]);

    // File upload
    async function handleFiles(files) {
        for (const f of Array.from(files)) {
            const res = await api.uploadImage(id, f);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
                alert(`Upload Blocked for ${f.name}:\n${err.detail}`);
            }
        }
        load();
    }

    // Generate report
    async function triggerGeneration() {
        setGenerating(true);
        const res = await api.generateReport(id);
        setGenerating(false);
        if (res.ok) load();
        else alert('Failed to queue analysis.');
    }

    // Interactive Support Desk Send Message (Streaming)
    async function sendMessage(overrideText = null) {
        const text = overrideText || chatInput;
        if (!text.trim() || !activeImgId) return;
        
        setChatInput("");
        setChatLoading(true);

        // 1. Add User Message to History
        const userMsg = { role: 'user', content: text };
        setChatHistory(prev => ({
            ...prev,
            [activeImgId]: [...(prev[activeImgId] || []), userMsg]
        }));

        try {
            const token = api.getToken();
            // Manual fetch for streaming reader support
            const res = await fetch(`/api/v1/diagnostics/images/${activeImgId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ message: text })
            });

            if (!res.ok) throw new Error("Chat link broke");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantText = "";

            // 2. Add placeholder for assistant response
            setChatHistory(prev => ({
                ...prev,
                [activeImgId]: [...(prev[activeImgId] || []), { role: 'assistant', content: '' }]
            }));

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '').trim();
                        if (jsonStr === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            assistantText += content;
                            
                            // 3. Update assistant message content dynamically
                            setChatHistory(prev => {
                                const currentHistory = prev[activeImgId] || [];
                                const updatedHistory = [...currentHistory];
                                if (updatedHistory.length > 0) {
                                    updatedHistory[updatedHistory.length - 1] = { role: 'assistant', content: assistantText };
                                }
                                return { ...prev, [activeImgId]: updatedHistory };
                            });
                        } catch (e) {
                            // Non-json chunk cleanup
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Chat Error:", err);
            setChatHistory(prev => ({
                ...prev,
                [activeImgId]: [...(prev[activeImgId] || []), { role: 'assistant', content: `[Error: Failed to fetch reply]` }]
            }));
        } finally {
            setChatLoading(false);
        }
    }

    // Interactive Support Desk for Patient Aggregate (Streaming)
    async function sendPatientMessage(overrideText = null) {
        const text = overrideText || chatInput;
        if (!text.trim()) return;
        
        setChatInput("");
        setChatLoading(true);

        const activeId = "patient"; 

        const userMsg = { role: 'user', content: text };
        setChatHistory(prev => ({
            ...prev,
            [activeId]: [...(prev[activeId] || []), userMsg]
        }));

        try {
            const token = api.getToken();
            const res = await fetch(`/api/v1/diagnostics/patients/${id}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ message: text })
            });

            if (!res.ok) throw new Error("Patient Chat failed");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantText = "";

            setChatHistory(prev => ({
                ...prev,
                [activeId]: [...(prev[activeId] || []), { role: 'assistant', content: '' }]
            }));

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '').trim();
                        if (jsonStr === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            assistantText += content;
                            
                            setChatHistory(prev => {
                                const currentHistory = prev[activeId] || [];
                                const updatedHistory = [...currentHistory];
                                if (updatedHistory.length > 0) {
                                    updatedHistory[updatedHistory.length - 1] = { role: 'assistant', content: assistantText };
                                }
                                return { ...prev, [activeId]: updatedHistory };
                            });
                        } catch (e) {}
                    }
                }
            }
        } catch (err) {
            console.error("Patient Chat Error:", err);
            setChatHistory(prev => ({
                ...prev,
                [activeId]: [...(prev[activeId] || []), { role: 'assistant', content: `[Error: Failed to fetch reply]` }]
            }));
        } finally {
            setChatLoading(false);
        }
    }

    // PDF download
    async function handleDownloadPDF() {
        setDownloading(true);
        const res = await api.downloadPDF(id);
        setDownloading(false);
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `GradVision_Report_P${id}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a); a.click();
            URL.revokeObjectURL(url); document.body.removeChild(a);
        } else alert('Report not ready or unavailable.');
    }

    // Delete patient
    async function handleDelete() {
        if (!confirm('Permanently delete this patient record? This cannot be undone.')) return;
        const res = await api.fetchAuth(`/patients/${id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) navigate('/');
        else alert('Failed to delete patient.');
    }

    // XAI helper
    function openXai(img) {
        setXaiImg({
            heatmap: img.heatmap_base64 ? `data:image/png;base64,${img.heatmap_base64}` : null,
            bounding: img.bounding_base64 ? `data:image/png;base64,${img.bounding_base64}` : null,
            morphology: img.morphology_img_base64 ? `data:image/png;base64,${img.morphology_img_base64}` : null,
        });
    }

    const hasPending = patient?.images?.some(i => i.status === 'PENDING');
    const hasReport = patient?.reports?.some(r => r.status === 'COMPLETED');
    const images = patient?.images || [];

    if (loading) return <div className="loading-state" style={{ height: '100vh' }}><div className="spinner" />Loading patient…</div>;

    const activeImg = images.find(i => i.id === activeImgId);

    // Get aggregate diagnosis badge for topbar
    const latestRep = patient?.reports?.length ? patient.reports.reduce((a, b) => a.id > b.id ? a : b) : null;
    let diagBadge = <span className="badge badge-gray">No Analysis</span>;
    if (latestRep?.status === 'COMPLETED') {
        diagBadge = latestRep.overall_prediction === 'MALIGNANT' 
            ? <span className="badge badge-red" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>⚠ Malignant</span>
            : <span className="badge badge-green" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>✓ Benign</span>;
    } else if (latestRep?.status === 'GENERATING') {
        diagBadge = <span className="badge badge-blue"><span className="status-dot dot-blue dot-pulse" /> &nbsp;Analyzing</span>;
    }

    return (
        <>
            <div className="app-shell">
                <Sidebar />

                <div className="main-area" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                    
                    {/* Topbar sticky */}
                    <div className="topbar" style={{ borderBottom: '1px solid var(--border)' }}>
                        <Link to="/" className="btn btn-ghost btn-sm" style={{ paddingLeft: '0.4rem' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                            Directory
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="topbar-title" style={{ fontWeight: 800 }}>{patient?.name}</div>
                            <span className="patient-id-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>P-{String(patient?.id || 0).padStart(4, '0')}</span>
                            {diagBadge}
                        </div>
                        <div className="topbar-actions">
                            <button className="btn btn-secondary btn-sm" onClick={triggerGeneration} disabled={images.length === 0 || generating}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                {generating ? 'Queuing…' : 'Run Analysis'}
                            </button>
                            {hasReport && (
                                <button className="btn btn-primary btn-sm" onClick={handleDownloadPDF} disabled={downloading}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    {downloading ? 'Preparing…' : 'Export PDF'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Banner */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div><strong>Age:</strong> {patient?.age || '—'}</div>
                        <div><strong>Sex:</strong> {patient?.sex || '—'}</div>
                        <div><strong>Scans Uploaded:</strong> {images.length} <span style={{ color: 'var(--text-muted)' }}>/ 5 max</span></div>
                        <div style={{ marginLeft: 'auto' }}>
                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)', fontWeight: 600 }} onClick={handleDelete}>Delete Patient File</button>
                        </div>
                    </div>

                    {/* Workspace Split */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', overflow: 'hidden' }}>
                        
                        {/* LEFT: Scans Navigator */}
                        <div style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Histopathology Scans</div>
                                {images.length < 5 && (
                                    <button className="btn btn-secondary btn-xs" onClick={() => document.getElementById('scan-file-input').click()}>+ Add</button>
                                )}
                            </div>
                            <input id="scan-file-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

                            {images.length === 0 && (
                                <div className="upload-zone" onClick={() => document.getElementById('scan-file-input').click()} style={{ padding: '2rem 1rem' }}>
                                    <div className="upload-zone-icon">🔬</div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem' }}>Upload H&E Scans</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* General Overview selection */}
                                <div className={`card ${!activeImgId ? 'active-scan' : ''}`} style={{ cursor: 'pointer', borderColor: !activeImgId ? 'var(--brand-500)' : 'var(--border)', background: !activeImgId ? 'var(--brand-50)' : 'transparent', boxShadow: !activeImgId ? '0 0 0 2px var(--brand-200)' : 'none' }} onClick={() => setActiveImgId(null)}>
                                    <div className="card-body" style={{ padding: '0.75rem' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>📋 Aggregated Clinical Report</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full AI synthesis & medical summary</div>
                                    </div>
                                </div>

                                {/* Image cards list */}
                                {images.map(img => {
                                    const mal = img.prediction_label === 'MALIGNANT';
                                    const active = activeImgId === img.id;
                                    return (
                                        <div key={img.id} className="card" style={{ cursor: 'pointer', borderColor: active ? 'var(--brand-500)' : 'var(--border)', background: active ? 'rgba(2,132,199,0.04)' : 'transparent', boxShadow: active ? '0 0 0 2px rgba(2,132,199,0.2)' : 'none' }} onClick={() => setActiveImgId(img.id)}>
                                            <div className="card-body" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Scan #{img.id}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {img.status === 'PROCESSED' ? `${(img.prediction_score * 100).toFixed(1)}% safe` : 'Pending processing'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {img.status === 'PROCESSED' && (
                                                        <span className={`badge ${mal ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem' }}>{img.prediction_label === 'MALIGNANT' ? 'MAG' : 'BEN'}</span>
                                                    )}
                                                    {img.status === 'PENDING' && <span className="badge badge-orange" style={{ padding: '0.2rem 0.4rem' }}>⏳</span>}
                                                    <button className="btn btn-ghost btn-xs" title="Delete Scan" style={{ color: 'var(--danger)', padding: '0.1rem 0.3rem', cursor: 'pointer' }} onClick={async e => {
                                                        e.stopPropagation();
                                                        if (confirm(`Permanently delete Scan #${img.id}?`)) {
                                                            await api.fetchAuth(`/diagnostics/images/${img.id}`, { method: 'DELETE' });
                                                            load();
                                                        }
                                                    }}>
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT: Main Workspace Viewport */}
                        <div style={{ background: 'var(--bg-secondary)', overflowY: 'auto', padding: '1.5rem' }}>
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                                
                                {!activeImg ? (
                                    /* 1. AGGREGATED REPORT VIEW */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div className="card">
                                            <div className="card-header">
                                                <div><div className="card-title">Aggregated AI Clinical Report</div><div className="card-subtitle">Automated Pathology Synthesis Doc</div></div>
                                            </div>
                                            <div className="card-body">
                                                <ReportPanel patient={patient} />
                                            </div>
                                        </div>
                                        <MorphologyPanel images={images} />

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
                                                
                                                {/* Quick Suggestions (Aggregated) */}
                                                <div style={{ padding: '0.4rem 0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                                                    {[
                                                        "Summarize aggregate risk", 
                                                        "Compare scan findings", 
                                                        "What does irregular nuclei signify?", 
                                                        "Next diagnostic steps"
                                                    ].map((q, idx) => (
                                                        <button key={idx} type="button" className="btn btn-ghost" style={{ fontSize: '0.675rem', padding: '0.2rem 0.4rem', borderRadius: '1rem', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => sendPatientMessage(q)}>
                                                            {q}
                                                        </button>
                                                    ))}
                                                </div>

                                                <form onSubmit={(e) => { e.preventDefault(); sendPatientMessage(); }} style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <input type="text" placeholder="Ask anything about this patient analysis..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.825rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} disabled={chatLoading} />
                                                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={chatLoading || !chatInput.trim()}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* 2. SPECIFIC SCAN DIAGNOSTIC VIEW */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div className="card">
                                            <div className="card-header">
                                                <div><div className="card-title">Diagnostic Viewer — Scan #{activeImg.id}</div><div className="card-subtitle">Layered activation mapping inspection</div></div>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openXai(activeImg)}>
                                                   🔍 High Resolution XAI
                                                </button>
                                            </div>
                                            <div className="card-body" style={{ padding: '1rem', textAlign: 'center' }}>
                                                {/* Grid for views if available */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                                    {activeImg.id && (
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Original Image</div>
                                                            <img src={`/api/v1/diagnostics/images/${activeImg.id}/file?token=${api.getToken()}`} alt="Original" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                                        </div>
                                                    )}
                                                    {activeImg.heatmap_base64 && (
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Grad-CAM Activation</div>
                                                            <img src={`data:image/png;base64,${activeImg.heatmap_base64}`} alt="Heatmap" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                                        </div>
                                                    )}
                                                    {activeImg.bounding_base64 && (
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Tumor Localization Box</div>
                                                            <img src={`data:image/png;base64,${activeImg.bounding_base64}`} alt="Localization" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                                        </div>
                                                    )}
                                                    {activeImg.morphology_img_base64 && (
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Cell Morphology Overlay</div>
                                                            <img src={`data:image/png;base64,${activeImg.morphology_img_base64}`} alt="Morphology" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Individual scan morphology breakdown */}
                                        {activeImg.morphology_json && (
                                            <div className="card">
                                                <div className="card-header">
                                                    <div><div className="card-title">Morphology Statistics</div><div className="card-subtitle">This scan only</div></div>
                                                </div>
                                                <div className="card-body">
                                                    {(() => {
                                                        try {
                                                            const m = JSON.parse(activeImg.morphology_json);
                                                            return (
                                                                <div className="demographics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                                    <div className="demo-item"><div className="demo-label">Nuclei Count</div><div className="demo-value">{m.cell_count || 0}</div></div>
                                                                    <div className="demo-item"><div className="demo-label">Irregular Nuclei Proportion</div><div className="demo-value">{((m.irregular_nuclei_ratio || 0) * 100).toFixed(1)}%</div></div>
                                                                    <div className="demo-item"><div className="demo-label">Detected Clusters</div><div className="demo-value">{m.cluster_count || 0}</div></div>
                                                                </div>
                                                            );
                                                        } catch (e) { return <div>Error parsing metadata</div>; }
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                        {/* Clinician Support Desk (Interactive Chat) */}
                                        <div className="card">
                                            <div className="card-header">
                                                <div><div className="card-title">💬 Clinician Support Desk</div><div className="card-subtitle">Consult NVIDIA Gemma-3B about this specimen</div></div>
                                            </div>
                                            <div className="card-body" style={{ padding: '0px' }}>
                                                {/* Chat Area */}
                                                <div style={{ height: '240px', overflowY: 'auto', padding: '1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                                    {!(chatHistory[activeImgId] || []).length && (
                                                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                                                            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>💬</div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>No messages yet</div>
                                                            <div style={{ fontSize: '0.7rem' }}>Ask an AI assistant questions regarding the diagnostics weights or image overlay triggers above!</div>
                                                        </div>
                                                    )}
                                                    {(chatHistory[activeImgId] || []).map((msg, i) => (
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
                                                
                                                {/* Quick Suggestions (Specific Scan) */}
                                                <div style={{ padding: '0.4rem 0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                                                    {[
                                                        "What triggered this prediction?", 
                                                        "Explain cell morphology stats", 
                                                        "How accurate is this specific scan?", 
                                                        "Compare to benign baseline"
                                                    ].map((q, idx) => (
                                                        <button key={idx} type="button" className="btn btn-ghost" style={{ fontSize: '0.675rem', padding: '0.2rem 0.4rem', borderRadius: '1rem', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => sendMessage(q)}>
                                                            {q}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Input form */}
                                                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <input type="text" placeholder="Ask anything about this scan analysis..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.825rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} disabled={chatLoading} />
                                                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={chatLoading || !chatInput.trim()}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                        
                                        </div>
                                    )}

                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {xaiImg && <XaiModal heatmap={xaiImg.heatmap} bounding={xaiImg.bounding} morphology={xaiImg.morphology} onClose={() => setXaiImg(null)} />}
        </>
    );
}
