
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Login from './components/Login';
import Profile from './components/Profile';
import AppLayout from './components/AppLayout';
import ModulePlaceholder from './components/ModulePlaceholder';
import { auth } from './services/firebaseConfig';

import Dashboard from './components/Dashboard';
import UsersModule from './components/UsersModule';
import ImageBankModule from './components/ImageBankModule';
import RequestsModule from './components/RequestsModule';
import ThemesModule from './components/ThemesModule';
import FlyersModule from './components/FlyersModule';
import CompanyProfile from './components/CompanyProfile';
import Companies from './components/Companies';
import LaminasModule from './components/LaminasModule';
import JobVacancyModule from './components/JobVacancyModule';
import Onboarding from './components/Onboarding';
import CreateCompany from './components/CreateCompany';
import JoinCompany from './components/JoinCompany';

// Admin Imports
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminApprovals from './components/AdminApprovals';
import FirestoreDebug from './components/FirestoreDebug';

// Protected Route Component
const ValidateSession = ({ children }: { children: React.ReactElement }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Pending State View
const PendingView = () => (
  <div className="auth-container">
    <div className="glass-card" style={{ textAlign: 'center' }}>
      <h2>Aguardando Aprovação ⏳</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Sua solicitação para entrar na empresa foi enviada. Aguarde o administrador aceitar.</p>
      <button onClick={() => auth.signOut()} className="btn btn-secondary" style={{ marginTop: '2rem' }}>Sair</button>
    </div>
  </div>
);

// Redirect to Onboarding instead of showing empty screen
const NoAccessView = () => <Navigate to="/onboarding" replace />;

// Route wrapper for inside the layout
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { userData, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
      </div>
    );
  }

  // Super Admins are exempt from checks
  if (userData?.role === 'super_admin') return children;

  // If no company and not super admin, redirect to onboarding if not already there
  if (!userData?.companyId) {
    return <Navigate to="/onboarding" replace />;
  }

  if (userData.status === 'pending') return <PendingView />;

  return children;
};

// Root Redirect Component
const RootRedirect = () => {
  const { userData, loading } = useAuth();
  if (loading) return null;

  if (userData?.role === 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Dashboard />;
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />


          {/* Master Admin Panel - Dedicated Route */}
          <Route path="/admin" element={
            <ValidateSession>
              <AdminLayout />
            </ValidateSession>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="empresas" element={<Companies />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="aprovacoes" element={<AdminApprovals />} />
            <Route path="debug" element={<FirestoreDebug />} />
            <Route path="temas" element={<ThemesModule />} />
            <Route path="solicitacoes" element={<RequestsModule />} />
          </Route>

          {/* App Layout Routes */}
          <Route element={
            <ValidateSession>
              <AppLayout />
            </ValidateSession>
          }>
            <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
            <Route path="/laminas" element={<ProtectedRoute><LaminasModule /></ProtectedRoute>} />
            <Route path="/artes-vagas" element={<ProtectedRoute><JobVacancyModule /></ProtectedRoute>} />
            <Route path="/banco-imagens" element={<ProtectedRoute><ImageBankModule /></ProtectedRoute>} />
            <Route path="/encartes" element={<ProtectedRoute><FlyersModule /></ProtectedRoute>} />
            <Route path="/company-profile" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
            <Route path="/crachas" element={<ProtectedRoute><ModulePlaceholder title="Crachás" /></ProtectedRoute>} />
            <Route path="/temas" element={<ProtectedRoute><ThemesModule /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><UsersModule /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/solicitacoes" element={<ProtectedRoute><RequestsModule /></ProtectedRoute>} />
          </Route>

          {/* Onboarding Routes */}
          <Route path="/onboarding" element={<ValidateSession><Onboarding /></ValidateSession>} />
          <Route path="/create-company" element={<ValidateSession><CreateCompany /></ValidateSession>} />
          <Route path="/join-company" element={<ValidateSession><JoinCompany /></ValidateSession>} />

          {/* Catch-all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
