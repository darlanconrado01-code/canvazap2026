
import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { doc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  LayoutDashboard,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { userData } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [stats, setStats] = useState({
    activeUsers: 0,
    pendingUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      if (!userData?.companyId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Company Info
        const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
        if (companyDoc.exists()) {
          setCompany(companyDoc.data());
        }

        // Stats
        const userQuery = query(collection(db, 'users'), where('companyId', '==', userData.companyId), where('status', '==', 'active'));
        const pendingQuery = query(collection(db, 'users'), where('companyId', '==', userData.companyId), where('status', '==', 'pending'));

        const userSnap = await getCountFromServer(userQuery);
        const pendingSnap = await getCountFromServer(pendingQuery);

        setStats({
          activeUsers: userSnap.data().count,
          pendingUsers: pendingSnap.data().count
        });

      } catch (e: any) {
        console.error("FIRESTORE ERROR (Dashboard)", {
          code: e?.code,
          message: e?.message,
          companyId: userData.companyId,
          uid: userData.uid
        });
        setError(e);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userData]);

  const handleCopyLink = () => {
    if (!company?.code) return;
    const link = `${window.location.origin}/join-company?code=${company.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = userData?.role === 'admin';
  const isSuperAdmin = userData?.role === 'super_admin';

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid var(--error-color)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: 'var(--error-color)' }}>Erro ao carregar Dashboard</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error.code}: {error.message}</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Tentar Novamente</button>
      </div>
    );
  }

  // Check if company is inactive - show support message
  if (company && company.status === 'inactive' && !isSuperAdmin) {
    const whatsappMessage = encodeURIComponent(
      `Olá, acabei de criar minha Empresa no sistema e gostaria de ativá-la.\n\nEmpresa: ${company.name}\nCódigo: ${company.code}\nMeu e-mail é: ${userData?.email}`
    );
    const whatsappUrl = `https://wa.me/5591984034863?text=${whatsappMessage}`;

    return (
      <div className="fade-in">
        <div className="glass-card" style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '2rem auto',
          border: '2px solid rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '2rem'
          }}>
            ⏳
          </div>

          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#F59E0B' }}>
            Empresa Aguardando Ativação
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Sua empresa <strong>{company.name}</strong> foi criada com sucesso, mas ainda está inativa.
            Entre em contato com nosso suporte para ativar sua conta.
          </p>

          <div style={{
            background: 'var(--bg-color)',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nome da Empresa:</strong>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{company.name}</div>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Código:</strong>
              <div style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>{company.code}</div>
            </div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              width: '100%',
              background: '#25D366',
              borderColor: '#25D366',
              textDecoration: 'none'
            }}
          >
            Chamar Suporte no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Welcome Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="title" style={{ fontSize: 'min(1.8rem, 7vw)' }}>Olá, {userData?.displayName?.split(' ')[0]} 👋</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Bem-vindo ao painel da {company?.name || 'Sua Empresa'}.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="responsive-grid" style={{ marginBottom: '2rem' }}>
        {/* Active Users Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(67, 24, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{stats.activeUsers}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Membros Ativos</div>
          </div>
        </div>

        {/* Pending Requests Card (Admin Only) */}
        {isAdmin && (
          <div
            className="glass-card"
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', cursor: stats.pendingUsers > 0 ? 'pointer' : 'default', border: stats.pendingUsers > 0 ? '1px solid #F59E0B' : 'none' }}
            onClick={() => stats.pendingUsers > 0 && navigate('/usuarios')}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <UserPlus size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{stats.pendingUsers}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Solicitações Pendentes</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>

          {/* Invite Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={20} className="text-primary" />
              Convidar Equipe
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
              Utilize o código abaixo para adicionar novos membros.
            </p>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>Código da Empresa</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--primary-color)' }}>{company?.code}</div>
              </div>
              <button
                onClick={handleCopyLink}
                className="btn-primary"
                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>

            <button
              onClick={() => navigate('/usuarios')}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px dashed var(--border-color)',
                background: 'transparent',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}
            >
              Gerenciar Usuários <ArrowRight size={16} />
            </button>
          </div>

          {/* Quick Shortcuts */}
          {userData?.companyModules && userData.companyModules.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LayoutDashboard size={20} className="text-primary" />
                Acesso Rápido
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {userData.companyModules.includes('laminas') && (
                  <button onClick={() => navigate('/laminas')} className="btn-secondary" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🖼️</span> <span style={{ fontSize: '0.85rem' }}>Lâminas</span>
                  </button>
                )}
                {userData.companyModules.includes('encartes') && (
                  <button onClick={() => navigate('/encartes')} className="btn-secondary" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>📚</span> <span style={{ fontSize: '0.85rem' }}>Encartes</span>
                  </button>
                )}
                {userData.companyModules.includes('artes-postagens') && (
                  <button onClick={() => navigate('/artes-postagens')} className="btn-secondary" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span> <span style={{ fontSize: '0.85rem' }}>Aprovações</span>
                  </button>
                )}
                {userData.companyModules.includes('tarefas') && (
                  <button onClick={() => navigate('/tarefas')} className="btn-secondary" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>📋</span> <span style={{ fontSize: '0.85rem' }}>Tarefas</span>
                  </button>
                )}
                {userData.companyModules.includes('temas') && (
                  <button onClick={() => navigate('/temas')} className="btn-secondary" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎨</span> <span style={{ fontSize: '0.85rem' }}>Temas</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
