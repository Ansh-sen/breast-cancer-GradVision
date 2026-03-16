// ============================================
//  GradVision — API Service Layer
// ============================================

const BASE_URL = '/api/v1';


// Token management
export const getToken = () => localStorage.getItem('gv_token');
export const setToken = (t) => localStorage.setItem('gv_token', t);
export const clearToken = () => localStorage.removeItem('gv_token');

// Authenticated fetch
export async function fetchAuth(path, options = {}) {
    const token = getToken();
    const headers = {
        ...(!options.body || options.body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

// Auth
export const login = (email, password) =>
    fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password }),
    });

export const register = (name, email, password) =>
    fetchAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    });

export const getMe = () => fetchAuth('/auth/me');

// Patients
export const getPatients = () => fetchAuth('/patients/');
export const getPatientDetail = (id) => fetchAuth(`/patients/${id}`);
export const createPatient = (data) =>
    fetchAuth('/patients/', { method: 'POST', body: JSON.stringify(data) });
export const deletePatient = (id) =>
    fetchAuth(`/patients/${id}`, { method: 'DELETE' });
export const updatePatient = (id, data) =>
    fetchAuth(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const importCSV = (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetchAuth('/patients/import', { method: 'POST', body: form });
};

// Images / Analysis
export const uploadImage = (patientId, file) => {
    const form = new FormData();
    form.append('file', file);
    return fetchAuth(`/diagnostics/patients/${patientId}/images`, { method: 'POST', body: form });
};
export const generateReport = (patientId) =>
    fetchAuth(`/diagnostics/patients/${patientId}/generate`, { method: 'POST' });

export const batchGenerate = (patientIds) =>
    fetchAuth('/diagnostics/batch-generate', {
        method: 'POST',
        body: JSON.stringify({ patient_ids: patientIds }),
    });

// PDF Report
export const downloadPDF = (patientId) =>
    fetchAuth(`/diagnostics/patients/${patientId}/report/pdf`, {
        headers: { Accept: 'application/pdf' },
    });
