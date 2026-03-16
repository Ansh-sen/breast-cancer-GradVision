import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777', '#ea580c', '#65a30d'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];

function getInitials(name = '') {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Sidebar({ patientCount = 0, selectedCount = 0, onImport, onBulkGenerate }) {
    const { doctor, logout, isDark, toggleTheme } = useAuth();
    const navigate = useNavigate();
    const initials = getInitials(doctor?.name);
    const color = avatarColor(doctor?.id);

    return (
        <aside className="sidebar">
            {/* Header / Logo */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">🔬</div>
                    <div>
                        <div className="sidebar-product-name">GradVision</div>
                        <div className="sidebar-product-tag">Clinical AI · v2.0</div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                <div className="nav-section-label">Workspace</div>

                <NavLink
                    to="/"
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Patient Directory
                    {patientCount > 0 && <span className="nav-badge">{patientCount}</span>}
                </NavLink>

                <div className="nav-section-label">Tools</div>

                <div className="nav-item" onClick={onImport}>
                    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Import CSV
                </div>

                {selectedCount > 0 && (
                    <div className="nav-item" onClick={onBulkGenerate}>
                        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Bulk Generate ({selectedCount})
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="sidebar-user-card">
                    <div className="user-avatar" style={{ background: color }}>{initials}</div>
                    <div>
                        <div className="user-name">{`Dr. ${doctor?.name || '—'}`}</div>
                        <div className="user-role">Attending Pathologist</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', padding: '0 0.25rem' }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--sidebar-text)' }} onClick={toggleTheme}>
                        {isDark ? '☀️' : '🌙'} Theme
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--sidebar-text)' }} onClick={() => { logout(); navigate('/login'); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        Sign out
                    </button>
                </div>
            </div>
        </aside>
    );
}
