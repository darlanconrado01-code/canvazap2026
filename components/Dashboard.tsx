
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
  const [userCount, setUserCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      if (!userData?.companyId) return;

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

        setUserCount(userSnap.data().count);
        setPendingCount(pendingSnap.data().count);

      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, [userData]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join-company?code=${company?.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = userData?.role === 'admin';

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
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{userCount}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Membros Ativos</div>
          </div>
        </div>

        {/* Pending Requests Card (Admin Only) */}
        {isAdmin && (
          <div
            className="glass-card"
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', cursor: pendingCount > 0 ? 'pointer' : 'default', border: pendingCount > 0 ? '1px solid #F59E0B' : 'none' }}
            onClick={() => pendingCount > 0 && navigate('/usuarios')}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <UserPlus size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{pendingCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Solicitações Pendentes</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions / Invite Section (Admin Only) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

          {/* Invite Card - Main Requirement */}
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Código da Empresa</div>
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

          {/* Quick Shortcuts */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LayoutDashboard size={20} className="text-primary" />
              Acesso Rápido
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button onClick={() => navigate('/laminas')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                <span>🖼️</span> Lâminas
              </button>
              <button onClick={() => navigate('/encartes')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                <span>📚</span> Encartes
              </button>
              <button onClick={() => navigate('/banco-imagens')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                <span>📸</span> Banco de Imagens
              </button>
              <button onClick={() => navigate('/crachas')} className="btn-secondary" style={{ height: '80px', flexDirection: 'column', gap: '0.5rem' }}>
                <span>🪪</span> Crachás
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;
