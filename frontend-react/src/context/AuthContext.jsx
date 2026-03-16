import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken as setTok, clearToken, getMe } from '../services/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [doctor, setDoctor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isDark, setIsDark] = useState(() => localStorage.getItem('gv_theme') === 'dark');

    useEffect(() => {
        document.body.classList.toggle('dark', isDark);
    }, [isDark]);

    useEffect(() => {
        const token = getToken();
        if (!token) { setLoading(false); return; }
        getMe().then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setDoctor(d); })
            .finally(() => setLoading(false));
    }, []);

    const login = (token, doctorData) => {
        setTok(token);
        setDoctor(doctorData);
    };

    const logout = () => {
        clearToken();
        setDoctor(null);
    };

    const toggleTheme = () => {
        setIsDark(v => {
            const next = !v;
            localStorage.setItem('gv_theme', next ? 'dark' : 'light');
            return next;
        });
    };

    return (
        <AuthCtx.Provider value={{ doctor, loading, login, logout, isDark, toggleTheme }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);
