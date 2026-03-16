import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import PatientPage from './pages/PatientPage';
import './index.css';

function PrivateRoute({ children }) {
  const { doctor, loading } = useAuth();
  if (loading) return (
    <div className="loading-state" style={{ height: '100vh' }}>
      <div className="spinner" />
      Loading…
    </div>
  );
  return doctor ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { doctor } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={doctor ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/patient/:id" element={<PrivateRoute><PatientPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
