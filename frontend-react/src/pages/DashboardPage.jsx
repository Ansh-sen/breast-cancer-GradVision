import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import * as api from '../services/api';

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777', '#ea580c', '#65a30d'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
const getInitials = (name = '') => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ---- Modals ---- //
function AddPatientModal({ onClose, onAdded }) {
    const [loading, setLoading] = useState(false);
    async function submit(e) {
        e.preventDefault();
        setLoading(true);
        const form = e.target;
        const res = await api.createPatient({
            name: form.name.value,
            age: parseInt(form.age.value) || null,
            sex: form.sex.value,
        });
        setLoading(false);
        if (res.ok) { onAdded(); onClose(); form.reset(); }
        else alert('Failed to create patient record.');
    }
    return (
        <div className="modal-backdrop open">
            <div className="modal-box">
                <div className="modal-head">
                    <div><div className="modal-title">Register New Patient</div><div className="modal-subtitle">Add a patient to your clinical directory</div></div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-field"><label className="form-label">Full Name</label><input className="form-input" name="name" required placeholder="Patient full name" /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-field"><label className="form-label">Age</label><input className="form-input" name="age" type="number" min="1" max="120" placeholder="Years" /></div>
                            <div className="form-field"><label className="form-label">Biological Sex</label>
                                <select className="form-select" name="sex">
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Record'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CsvModal({ onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const dzRef = useRef();

    async function submit() {
        if (!file) return;
        setLoading(true);
        const res = await api.importCSV(file);
        setLoading(false);
        if (res.ok) { const d = await res.json(); alert(`✓ ${d.message}`); onImported(); onClose(); }
        else { const e = await res.json(); alert('Import failed: ' + (e.detail || 'Unknown')); }
    }

    return (
        <div className="modal-backdrop open">
            <div className="modal-box">
                <div className="modal-head">
                    <div><div className="modal-title">Bulk Import Patients</div><div className="modal-subtitle">Upload a CSV to register multiple patients at once</div></div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div style={{ background: 'var(--info-bg)', border: '1px solid rgba(2,132,199,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--info)' }}>
                        <strong>Required columns:</strong> <code style={{ fontFamily: 'var(--font-mono)' }}>name, age, sex</code>
                    </div>
                    <div ref={dzRef} className={`drop-zone${file ? ' dragover' : ''}`}
                        onClick={() => document.getElementById('csv-file-input').click()}
                        onDragOver={e => { e.preventDefault(); dzRef.current.classList.add('dragover'); }}
                        onDragLeave={() => dzRef.current.classList.remove('dragover')}
                        onDrop={e => { e.preventDefault(); dzRef.current.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) setFile(f); }}>
                        <div className="drop-zone-icon">📄</div>
                        <div className="drop-zone-text">{file ? `✓ ${file.name}` : 'Click or drag & drop CSV file'}</div>
                        <div className="drop-zone-hint">Only .CSV — UTF-8 encoded</div>
                        <input id="csv-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!file || loading} onClick={submit}>{loading ? 'Importing…' : 'Import Records'}</button>
                </div>
            </div>
        </div>
    );
}

// ---- Edit Patient Modal ---- //
function EditPatientModal({ patient, onClose, onUpdated }) {
    const [loading, setLoading] = useState(false);
    async function submit(e) {
        e.preventDefault();
        setLoading(true);
        const form = e.target;
        const res = await api.fetchAuth(`/patients/${patient.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: form.name.value,
                age: parseInt(form.age.value) || null,
                sex: form.sex.value,
            })
        });
        setLoading(false);
        if (res.ok) { onUpdated(); onClose(); }
        else alert('Failed to update patient record.');
    }
    return (
        <div className="modal-backdrop open">
            <div className="modal-box">
                <div className="modal-head">
                    <div><div className="modal-title">Edit Patient</div><div className="modal-subtitle">Update patient information</div></div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-field"><label className="form-label">Full Name</label><input className="form-input" name="name" defaultValue={patient.name} required /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-field"><label className="form-label">Age</label><input className="form-input" name="age" type="number" defaultValue={patient.age || ''} min="1" max="120" /></div>
                            <div className="form-field"><label className="form-label">Biological Sex</label>
                                <select className="form-select" name="sex" defaultValue={patient.sex}>
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Updating…' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---- Status Badges ---- //
function StatusBadge({ patient }) {
    const hasPend = patient.images?.some(i => i.status === 'PENDING');
    const hasReport = patient.reports?.length > 0;
    const latest = hasReport ? patient.reports.reduce((a, b) => a.id > b.id ? a : b) : null;

    if (!patient.images?.length) return <span className="badge badge-gray">No Scans</span>;
    if (hasPend) return <span className="badge badge-orange"><span className="status-dot dot-orange dot-pulse" />&nbsp;Pending</span>;
    if (latest?.status === 'GENERATING') return <span className="badge badge-blue"><span className="status-dot dot-blue dot-pulse" />&nbsp;Analyzing</span>;
    if (latest?.status === 'COMPLETED') return <span className="badge badge-green"><span className="status-dot dot-green" />&nbsp;Completed</span>;
    return <span className="badge badge-gray">Uploaded</span>;
}

function DiagBadge({ patient }) {
    const latest = patient.reports?.length ? patient.reports.reduce((a, b) => a.id > b.id ? a : b) : null;
    if (!latest || latest.status !== 'COMPLETED') return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    if (latest.overall_prediction === 'MALIGNANT') return <span className="badge badge-red">⚠ Malignant</span>;
    if (latest.overall_prediction === 'BENIGN') return <span className="badge badge-green">✓ Benign</span>;
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}

// ---- Main Dashboard ---- //
export default function DashboardPage() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [showAdd, setShowAdd] = useState(false);
    const [showCsv, setShowCsv] = useState(false);
    const [editPat, setEditPat] = useState(null);

    async function load() {
        setLoading(true);
        try {
            const res = await api.getPatients();
            const data = res.ok ? await res.json() : [];
            setPatients(data);
            setFiltered(data);
        } finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);
    useEffect(() => {
        const q = search.toLowerCase();
        setFiltered(patients.filter(p => p.name.toLowerCase().includes(q) || `p-${p.id}`.includes(q)));
    }, [search, patients]);

    // STATS
    const total = patients.length;
    const pending = patients.filter(p => p.images?.some(i => i.status === 'PENDING')).length;
    const ready = patients.filter(p => p.reports?.some(r => r.status === 'COMPLETED')).length;
    const malignant = patients.filter(p => p.reports?.some(r => r.status === 'COMPLETED' && r.overall_prediction === 'MALIGNANT')).length;

    // Bulk gen
    async function handleBulkGenerate() {
        const ids = [...selected];
        if (!ids.length) return;
        const res = await api.batchGenerate(ids);
        if (res.ok) { const d = await res.json(); alert(`✓ ${d.message}`); setSelected(new Set()); load(); }
        else alert('Failed to queue batch generation.');
    }

    // Bulk delete
    async function handleBulkDelete() {
        if (!confirm(`Permanently delete ${selected.size} patient records? This will delete all their scans and reports.`)) return;
        for (const id of selected) {
            await api.fetchAuth(`/patients/${id}`, { method: 'DELETE' });
        }
        setSelected(new Set());
        load();
    }

    const pendingPatients = patients.filter(p => p.images?.some(i => i.status === 'PENDING'));
    function toggleSelectAll(checked) {
        if (checked) setSelected(new Set(pendingPatients.map(p => p.id)));
        else setSelected(new Set());
    }
    function toggleOne(id, checked) {
        const s = new Set(selected);
        checked ? s.add(id) : s.delete(id);
        setSelected(s);
    }

    return (
        <>
            <div className="app-shell">
                <Sidebar
                    patientCount={total}
                    selectedCount={selected.size}
                    onImport={() => setShowCsv(true)}
                    onBulkGenerate={handleBulkGenerate}
                />

                <div className="main-area">
                    {/* Topbar */}
                    <div className="topbar">
                        <div className="topbar-title">Patient Directory</div>
                        <div className="topbar-actions">
                            {/* Removed topbar checkbox */}
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowCsv(true)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                Import CSV
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Add Patient
                            </button>
                        </div>
                    </div>

                    {/* Page content */}
                    <div className="page-content">
                        {/* Stats */}
                        <div className="stats-row">
                            {[
                                { icon: '👥', cls: 'blue', label: 'Total Patients', value: total, sub: 'In your directory' },
                                { icon: '⏳', cls: 'orange', label: 'Pending Analysis', value: pending, sub: 'Awaiting processing' },
                                { icon: '✅', cls: 'green', label: 'Reports Ready', value: ready, sub: 'Completed diagnoses' },
                                { icon: '🔴', cls: 'red', label: 'High Risk', value: malignant || '—', sub: 'Malignant findings' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
                                    <div>
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value">{s.value}</div>
                                        <div className="stat-sub">{s.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className="toolbar">
                            <div className="toolbar-left">
                                <div className="search-box" style={{ width: '400px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients by name or ID…" />
                                </div>
                            </div>
                            <div className="toolbar-right">
                                {selected.size > 0 && (
                                    <button className="btn btn-danger btn-sm" style={{ padding: '0.4rem 0.75rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onClick={handleBulkDelete}>
                                        Delete Selected ({selected.size})
                                    </button>
                                )}
                                {selected.size > 0 && (
                                    <button className="btn btn-primary btn-sm" onClick={handleBulkGenerate}>
                                        Run Analysis ({selected.size})
                                    </button>
                                )}
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                    const pendingAnalysis = patients.filter(p => (p.images || []).length > 0 && !p.reports?.some(r => r.status === 'COMPLETED'));
                                    setSelected(new Set(pendingAnalysis.map(p => p.id)));
                                }}>
                                    Select Pending
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={load}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="data-table-wrap">
                            {loading ? (
                                <div className="loading-state"><div className="spinner" />Loading patients…</div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-check"></th>
                                            <th>Patient</th><th>Age</th><th>Sex</th>
                                            <th>Scans</th><th>Status</th><th>Diagnosis</th><th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan={8}>
                                                <div className="empty-state">
                                                    <div className="empty-state-icon">🗂️</div>
                                                    <div className="empty-state-title">No patients in directory</div>
                                                    <div className="empty-state-text">Add your first patient or import a CSV to get started.</div>
                                                </div>
                                            </td></tr>
                                        ) : filtered.map(pat => {
                                            const hasPend = pat.images?.some(i => i.status === 'PENDING');
                                            const initials = getInitials(pat.name);
                                            const color = avatarColor(pat.id);
                                            return (
                                                <tr key={pat.id} className={selected.has(pat.id) ? 'selected' : ''} onClick={() => navigate(`/patient/${pat.id}`)}>
                                                    <td className="col-check" onClick={e => e.stopPropagation()}>
                                                        <input type="checkbox"
                                                            style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }}
                                                            checked={selected.has(pat.id)}
                                                            onChange={e => toggleOne(pat.id, e.target.checked)} />
                                                    </td>
                                                    <td>
                                                        <div className="patient-name-cell">
                                                            <div className="patient-avatar-sm" style={{ background: color }}>{initials}</div>
                                                            <div>
                                                                <div className="cell-primary">{pat.name}</div>
                                                                <div className="cell-secondary">P-{String(pat.id).padStart(4, '0')}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{pat.age || '—'}</td>
                                                    <td>{pat.sex || '—'}</td>
                                                    <td><span style={{ fontWeight: 600 }}>{(pat.images || []).length}</span><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>/5</span></td>
                                                    <td><StatusBadge patient={pat} /></td>
                                                    <td><DiagBadge patient={pat} /></td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={e => { e.stopPropagation(); setEditPat(pat); }}>
                                                                ✏️
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" title="Delete" style={{ color: 'var(--danger)' }} onClick={async e => { 
                                                                e.stopPropagation(); 
                                                                if (confirm(`Delete ${pat.name}?`)) { 
                                                                    await api.fetchAuth(`/patients/${pat.id}`, { method: 'DELETE' }); load(); 
                                                                }
                                                            }}>
                                                                🗑️
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/patient/${pat.id}`); }}>Open →</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} onAdded={load} />}
            {showCsv && <CsvModal onClose={() => setShowCsv(false)} onImported={load} />}
            {editPat && <EditPatientModal patient={editPat} onClose={() => setEditPat(null)} onUpdated={load} />}
        </>
    );
}
