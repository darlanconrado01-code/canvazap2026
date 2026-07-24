
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import MerchandiseModule from './components/MerchandiseModule';

import ArtApprovalModule from './components/ArtApprovalModule';
import Onboarding from './components/Onboarding';
import CreateCompany from './components/CreateCompany';
import JoinCompany from './components/JoinCompany';
import VaccineBlastsModule from './components/VaccineBlastsModule';
import AntiparasiticBlastsModule from './components/AntiparasiticBlastsModule';
import PetVilleBlastsModule from './components/PetVilleBlastsModule';

import LocucoesModule from './components/LocucoesModule';
import TranscreverZapModule from './components/TranscreverZapModule';
import TutorialsModule from './components/TutorialsModule';
import BadgeManagementModule from './components/BadgeManagementModule';

import { MessageCircle } from 'lucide-react';

// Admin Imports
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import AdminUsers from './components/AdminUsers';
import AdminApprovals from './components/AdminApprovals';
import FirestoreDebug from './components/FirestoreDebug';
import BusinessCategoriesModule from './components/BusinessCategoriesModule';
import AdminImageBankModule from './components/AdminImageBankModule';
import AdminBlastsReportModule from './components/AdminBlastsReportModule';
import AdminLocucoesModule from './components/AdminLocucoesModule';
import AdminNotifications from './components/AdminNotifications';
import AdminLocutoresModule from './components/AdminLocutoresModule';
import BudgetModule from './components/BudgetModule';
import PublicProposal from './components/PublicProposal';
import SuperAdminArtModule from './components/SuperAdminArtModule';
import TrelloModule from './components/TrelloModule';

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

  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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

// Blocked Subscription View
const BlockedView = ({ companyName, companyCode, userEmail }: { companyName?: string, companyCode?: string, userEmail?: string }) => {
  const whatsappMessage = encodeURIComponent(
    `Olá, minha empresa *${companyName || 'minha empresa'}* está bloqueada ou em atraso e gostaria de regularizar o acesso.\n\nEmpresa: ${companyName}\nCódigo: ${companyCode}\nMeu e-mail é: ${userEmail}`
  );
  const whatsappUrl = `https://wa.me/5591984034863?text=${whatsappMessage}`;

  return (
    <div className="auth-container">
      <div className="glass-card" style={{ textAlign: 'center', maxWidth: '500px', border: '2px solid #ef4444' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🛑</div>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Acesso Interrompido</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
          O acesso da empresa <strong>{companyName}</strong> está temporariamente suspenso devido à falta de regularização na assinatura.
        </p>

        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left', fontSize: '0.85rem' }}>
          <div><strong>Código:</strong> {companyCode}</div>
          <div><strong>E-mail:</strong> {userEmail}</div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', marginBottom: '1.2rem' }}>
            Para restabelecer o acesso agora mesmo, clique no botão abaixo e fale com nosso suporte financeiro.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#25D366', borderColor: '#25D366', color: 'white', fontWeight: 700 }}
          >
            <MessageCircle size={20} />
            Regularizar via WhatsApp
          </a>
        </div>
        <button onClick={() => auth.signOut()} className="btn btn-secondary" style={{ width: '100%' }}>Sair do Sistema</button>
      </div>
    </div>
  );
};

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

  // --- Subscription Guard ---
  const sub = userData.companySubscription;
  const companyName = userData.memberships?.find(m => m.companyId === userData.companyId)?.companyName;
  const companyCode = userData.companyCode || '';
  const userEmail = userData.email || '';

  if (sub) {
    if (sub.status === 'blocked' || sub.status === 'overdue') {
      return <BlockedView companyName={companyName} companyCode={companyCode} userEmail={userEmail} />;
    }

    if (sub.plan !== 'vitalicio' && sub.expiryDate) {
      const expiry = sub.expiryDate.toDate ? sub.expiryDate.toDate() : new Date(sub.expiryDate);
      const isExpired = expiry < new Date();
      if (isExpired) {
        return <BlockedView companyName={companyName} companyCode={companyCode} userEmail={userEmail} />;
      }
    }
  } else if (!userData.isSystemAdmin) {
    // If no subscription object exists yet, we might want to allow access or block. 
    // Usually new companies need a trial or immediate setup. 
    // For now, let's treat "no sub" as active until admin configures it, OR block it.
    // User said: "Quando a empresa não está com pagamento em dia, o sistema desativa"
    // I'll allow access if sub is missing to avoid locking out new companies before admin can touch them.
  }

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
            <Route path="categorias" element={<BusinessCategoriesModule />} />
            <Route path="temas" element={<ThemesModule />} />
            <Route path="solicitacoes" element={<RequestsModule />} />

            <Route path="artes-postagens" element={<ArtApprovalModule />} />
            <Route path="encartes" element={<FlyersModule isMasterMode={true} initialAvailability="encartes" />} />
            <Route path="catalogos" element={<FlyersModule isMasterMode={true} initialAvailability="catalogo" />} />
            <Route path="laminas" element={<LaminasModule isMasterMode={true} />} />
            <Route path="banco-imagens" element={<AdminImageBankModule />} />
            <Route path="locucoes" element={<AdminLocucoesModule />} />
            <Route path="locutores" element={<AdminLocutoresModule />} />
            <Route path="relatorio-disparos" element={<AdminBlastsReportModule />} />

            <Route path="notificacoes" element={<AdminNotifications />} />
            <Route path="orcamentos" element={<BudgetModule />} />
            <Route path="criacao-artes" element={<SuperAdminArtModule />} />
            <Route path="merchandise" element={<MerchandiseModule />} />
            <Route path="crachas" element={<BadgeManagementModule />} />
            <Route path="tutoriais" element={<TutorialsModule />} />
            <Route path="transcrever-zap" element={<TranscreverZapModule />} />
            <Route path="trello" element={<TrelloModule />} />
          </Route>

          {/* Public Proposal Route */}
          <Route path="/proposta/:id" element={<PublicProposal />} />


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
            <Route path="/encartes" element={<ProtectedRoute><FlyersModule initialAvailability="encartes" /></ProtectedRoute>} />
            <Route path="/catalogos" element={<ProtectedRoute><FlyersModule initialAvailability="catalogo" /></ProtectedRoute>} />
            <Route path="/artes-postagens" element={<ProtectedRoute><ArtApprovalModule /></ProtectedRoute>} />
            <Route path="/company-profile" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
            <Route path="/crachas" element={<ProtectedRoute><BadgeManagementModule /></ProtectedRoute>} />
            <Route path="/temas" element={<ProtectedRoute><ThemesModule /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><UsersModule /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/solicitacoes" element={<ProtectedRoute><RequestsModule /></ProtectedRoute>} />

            <Route path="/disparos-vacinas" element={<ProtectedRoute><VaccineBlastsModule /></ProtectedRoute>} />
            <Route path="/disparos-antiparasitarios" element={<ProtectedRoute><AntiparasiticBlastsModule /></ProtectedRoute>} />
            <Route path="/disparos-petville" element={<ProtectedRoute><PetVilleBlastsModule /></ProtectedRoute>} />

            <Route path="/locucoes" element={<ProtectedRoute><LocucoesModule /></ProtectedRoute>} />
            <Route path="/transcrever-zap" element={<ProtectedRoute><TranscreverZapModule /></ProtectedRoute>} />
            <Route path="/tutoriais" element={<ProtectedRoute><TutorialsModule /></ProtectedRoute>} />
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
