
import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db, auth } from '../services/firebaseConfig';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import {
    Users,
    Building2,
    TrendingUp,
    Activity
} from 'lucide-react';
import { MODULES } from './SidebarMenu';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const { userData } = useAuth();
    const [stats, setStats] = useState({
        activeUsers: 0,
        totalCompanies: 0
    });
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const companiesSnap = await getDocs(collection(db, 'companies'));
                const companiesData = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCompanies(companiesData);

                const usersSnap = await getCountFromServer(collection(db, 'users'));
                setStats({
                    totalCompanies: companiesData.length,
                    activeUsers: usersSnap.data().count
                });
            } catch (e: any) {
                console.error("FIRESTORE ERROR (fetchStats AdminDashboard)", {
                    code: e?.code,
                    message: e?.message,
                    uid: auth.currentUser?.uid
                });
                setError(e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [userData]);

    if (error) {
        return (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                <h3>Erro de Conexão Firestore</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{error.code}: {error.message}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>Recarregar</button>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="title" style={{ fontSize: '1.8rem' }}>Painel de Controle Global 🌎</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Visão geral de todas as empresas e usuários do sistema CanvaZap.</p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(67, 24, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <Building2 size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{stats.totalCompanies}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Empresas Cadastradas</div>
                    </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-color)' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{stats.activeUsers}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Usuários no Sistema</div>
                    </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{stats.totalCompanies > 0 ? (stats.activeUsers / stats.totalCompanies).toFixed(1) : 0}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Média Usuários/Empresa</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="title" style={{ fontSize: '1.4rem' }}>Empresas Recentes</h3>
                <button onClick={() => navigate('/admin/empresas')} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    Gerenciar Todas as Empresas
                </button>
            </div>

            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Empresa</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Código</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Módulos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                                </td>
                            </tr>
                        ) : companies.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma empresa encontrada.</td>
                            </tr>
                        ) : (
                            companies.slice(0, 5).map(comp => (
                                <tr key={comp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Building2 size={16} />
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{comp.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}><code>{comp.code}</code></td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            background: comp.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                            color: comp.status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        }}>
                                            {comp.status === 'active' ? 'ATIVA' : 'INATIVA'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                            {(comp.modules || []).slice(0, 2).map((mId: string) => (
                                                <span key={mId} style={{ fontSize: '0.65rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {MODULES.find(m => m.id === mId)?.name || mId}
                                                </span>
                                            ))}
                                            {(comp.modules || []).length > 2 && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{comp.modules.length - 2}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;
