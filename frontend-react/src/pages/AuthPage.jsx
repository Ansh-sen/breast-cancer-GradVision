import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function AuthPage() {
    const { login } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [loginErr, setLoginErr] = useState('');
    const [regErr, setRegErr] = useState('');
    const [loading, setLoading] = useState(false);

    // LOGIN
    async function handleLogin(e) {
        e.preventDefault();
        setLoginErr(''); setLoading(true);
        const form = e.target;
        try {
            const res = await api.login(form.email.value, form.password.value);
            if (res.ok) {
                const data = await res.json();
                const meRes = await fetch('/api/v1/auth/me', {
                    headers: { Authorization: `Bearer ${data.access_token}` }
                });
                const me = await meRes.json();
                login(data.access_token, me);
            } else {
                const err = await res.json();
                setLoginErr(err.detail || 'Sign in failed. Check your credentials.');
            }
        } catch {
            setLoginErr('Connection error — is the server running?');
        } finally { setLoading(false); }
    }

    // REGISTER
    async function handleRegister(e) {
        e.preventDefault();
        setRegErr(''); setLoading(true);
        const form = e.target;
        try {
            const res = await api.register(form.name.value, form.email.value, form.password.value);
            if (res.ok) {
                const lr = await api.login(form.email.value, form.password.value);
                const data = await lr.json();
                const meRes = await fetch('/api/v1/auth/me', {
                    headers: { Authorization: `Bearer ${data.access_token}` }
                });
                login(data.access_token, await meRes.json());
            } else {
                const err = await res.json();
                setRegErr(err.detail || 'Registration failed.');
            }
        } catch { setRegErr('Connection error.'); }
        finally { setLoading(false); }
    }

    return (
        <div className="auth-page">
            {/* ---- HERO ---- */}
            <div className="auth-hero">
                <div className="auth-hero-content">
                    <div className="auth-brand">
                        <div className="auth-brand-icon">🔬</div>
                        <div className="auth-brand-name">GradVision</div>
                    </div>
                    <div className="auth-hero-title">Clinical AI<br />for Pathologists</div>
                    <div className="auth-hero-subtitle">
                        AI-assisted breast cancer histopathology analysis powered by Grad-CAM explainable neural networks. Trusted by oncology departments worldwide.
                    </div>
                </div>

                <div className="auth-feature-list">
                    {[
                        'Grad-CAM heatmap visualization for every scan',
                        'Automated consolidated pathology reports',
                        'HIPAA-compliant multi-tenant architecture',
                        'Background processing — queue and return later',
                    ].map(f => (
                        <div key={f} className="auth-feature">
                            <div className="auth-feature-dot" />
                            {f}
                        </div>
                    ))}
                </div>
            </div>

            {/* ---- FORM PANEL ---- */}
            <div className="auth-panel">
                {mode === 'login' ? (
                    <div className="auth-form-wrap">
                        <div className="auth-form-title">Welcome back</div>
                        <div className="auth-form-subtitle">Sign in to your GradVision workspace</div>

                        <form onSubmit={handleLogin}>
                            <div className="form-field">
                                <label className="form-label">Email address</label>
                                <input className="form-input" name="email" type="email" placeholder="doctor@hospital.org" required autoComplete="email" />
                            </div>
                            <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Password</label>
                                <input className="form-input" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', fontSize: '0.875rem' }} disabled={loading}>
                                {loading ? 'Signing in…' : 'Sign in to Dashboard'}
                            </button>
                        </form>

                        {loginErr && <div className="form-error">{loginErr}</div>}

                        <div className="auth-switch-link">
                            New to GradVision? <a onClick={() => { setMode('register'); setLoginErr(''); }}>Create your account</a>
                        </div>
                    </div>
                ) : (
                    <div className="auth-form-wrap">
                        <div className="auth-form-title">Create account</div>
                        <div className="auth-form-subtitle">Join as a licensed clinical provider</div>

                        <form onSubmit={handleRegister}>
                            <div className="form-field">
                                <label className="form-label">Full name</label>
                                <input className="form-input" name="name" type="text" placeholder="Dr. John Smith" required />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Email address</label>
                                <input className="form-input" name="email" type="email" placeholder="doctor@hospital.org" required />
                            </div>
                            <div className="form-field" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Password</label>
                                <input className="form-input" name="password" type="password" placeholder="Min. 8 characters" required />
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', fontSize: '0.875rem' }} disabled={loading}>
                                {loading ? 'Creating account…' : 'Create account'}
                            </button>
                        </form>

                        {regErr && <div className="form-error">{regErr}</div>}

                        <div className="auth-switch-link">
                            Already registered? <a onClick={() => { setMode('login'); setRegErr(''); }}>Sign in here</a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
