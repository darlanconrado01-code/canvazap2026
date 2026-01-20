
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import CreateCompany from './components/CreateCompany';
import JoinCompany from './components/JoinCompany';
import Profile from './components/Profile';
import AppLayout from './components/AppLayout';
import ModulePlaceholder from './components/ModulePlaceholder';
import { auth } from './services/firebaseConfig';
import { LogOut } from 'lucide-react';

import Dashboard from './components/Dashboard';
import UsersModule from './components/UsersModule';
import ImageBankModule from './components/ImageBankModule';
import RequestsModule from './components/RequestsModule';
import ThemesModule from './components/ThemesModule';
import FlyersModule from './components/FlyersModule';
import CompanyProfile from './components/CompanyProfile';

// Protected Route Component
const ValidateSession = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth(); // ... rest of component


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

// Route wrapper for inside the layout
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { userData, loading } = useAuth();
  if (loading) return null;

  if (!userData?.companyId) return <Navigate to="/onboarding" />;
  if (userData.status === 'pending') return <PendingView />;

  return children;
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/onboarding" element={
            <ValidateSession>
              <Onboarding />
            </ValidateSession>
          } />

          <Route path="/create-company" element={
            <ValidateSession>
              <CreateCompany />
            </ValidateSession>
          } />

          <Route path="/join-company" element={
            <ValidateSession>
              <JoinCompany />
            </ValidateSession>
          } />

          {/* App Layout Routes */}
          <Route element={
            <ValidateSession>
              <AppLayout />
            </ValidateSession>
          }>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/laminas" element={<ProtectedRoute><ModulePlaceholder title="Lâminas" /></ProtectedRoute>} />
            <Route path="/laminas-plus" element={<ProtectedRoute><ModulePlaceholder title="Lâminas Plus" /></ProtectedRoute>} />
            <Route path="/banco-imagens" element={<ProtectedRoute><ImageBankModule /></ProtectedRoute>} />
            <Route path="/encartes" element={<ProtectedRoute><FlyersModule /></ProtectedRoute>} />
            <Route path="/company-profile" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
            <Route path="/crachas" element={<ProtectedRoute><ModulePlaceholder title="Crachás" /></ProtectedRoute>} />
            <Route path="/temas" element={<ProtectedRoute><ThemesModule /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><UsersModule /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/solicitacoes" element={<ProtectedRoute><RequestsModule /></ProtectedRoute>} />
          </Route>

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
