
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
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '4rem auto',
          border: '2px solid rgba(245, 158, 11, 0.3)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.1) 100%)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem',
            fontSize: '2.5rem'
          }}>
            ⏳
          </div>

          <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: '#F59E0B' }}>
            Empresa Aguardando Ativação
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: '1.6' }}>
            Sua empresa <strong>{company.name}</strong> foi criada com sucesso, mas ainda está inativa.
            Entre em contato com nosso suporte para ativar sua conta e começar a usar todos os recursos do sistema.
          </p>

          <div style={{
            background: 'var(--bg-color)',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nome da Empresa:</strong>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>{company.name}</div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Código:</strong>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem', fontFamily: 'monospace' }}>{company.code}</div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Seu E-mail:</strong>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>{userData?.email}</div>
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
              fontSize: '1.1rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              textDecoration: 'none'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Chamar Suporte no WhatsApp
          </a>

          <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Nossa equipe responderá em breve e ativará sua empresa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Welcome Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="title" style={{ fontSize: '1.8rem' }}>Olá, {userData?.displayName?.split(' ')[0]} 👋</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Bem-vindo ao painel da {company?.name || 'Sua Empresa'}.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Active Users Card */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(67, 24, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{stats.activeUsers}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Membros Ativos</div>
          </div>
        </div>

        {/* Pending Requests Card (Admin Only) */}
        {isAdmin && (
          <div
            className="glass-card"
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', cursor: stats.pendingUsers > 0 ? 'pointer' : 'default', border: stats.pendingUsers > 0 ? '1px solid #F59E0B' : 'none' }}
            onClick={() => stats.pendingUsers > 0 && navigate('/usuarios')}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <UserPlus size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{stats.pendingUsers}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Solicitações Pendentes</div>
            </div>
          </div>
        )}
      </div>

      {/* Regular Admin Quick Actions */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

          {/* Invite Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={20} className="text-primary" />
                  Convidar Equipe
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  Utilize este código ou link para adicionar novos membros.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Código da Empresa</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--primary-color)' }}>{company?.code}</div>
              </div>
              <div style={{ width: '1px', height: '40px', background: 'var(--border-color)' }}></div>
              <button
                onClick={handleCopyLink}
                className="btn-primary"
                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>

            <button
              onClick={() => navigate('/usuarios')}
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '1px dashed var(--border-color)',
                background: 'transparent',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              Gerenciar Usuários e Convites por E-mail <ArrowRight size={16} />
            </button>
          </div>

          {/* Quick Shortcuts - Only show enabled modules */}
          {userData?.companyModules && userData.companyModules.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LayoutDashboard size={20} className="text-primary" />
                Acesso Rápido
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                {userData.companyModules.includes('laminas') && (
                  <button onClick={() => navigate('/laminas')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>🖼️</span> Lâminas
                  </button>
                )}
                {userData.companyModules.includes('laminas-plus') && (
                  <button onClick={() => navigate('/laminas-plus')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>✨</span> Lâminas Plus
                  </button>
                )}
                {userData.companyModules.includes('encartes') && (
                  <button onClick={() => navigate('/encartes')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>📚</span> Encartes
                  </button>
                )}
                {userData.companyModules.includes('banco-imagens') && (
                  <button onClick={() => navigate('/banco-imagens')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>📸</span> Banco de Imagens
                  </button>
                )}
                {userData.companyModules.includes('crachas') && (
                  <button onClick={() => navigate('/crachas')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>🪪</span> Crachás
                  </button>
                )}
                {userData.companyModules.includes('temas') && (
                  <button onClick={() => navigate('/temas')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>🎨</span> Temas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* No modules enabled message */}
          {(!userData?.companyModules || userData.companyModules.length === 0) && (
            <div className="glass-card" style={{
              padding: '2rem',
              textAlign: 'center',
              border: '2px dashed var(--border-color)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Nenhum Módulo Habilitado
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Entre em contato com o suporte para habilitar módulos para sua empresa.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default Dashboard;
