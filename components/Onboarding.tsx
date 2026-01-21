
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserPlus, LogOut, Shield } from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { useAuth } from './AuthContext';

const Onboarding = () => {
    const navigate = useNavigate();
    const { userData } = useAuth();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div className="auth-container">
            <div className="glass-card fade-in" style={{ maxWidth: '1200px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 className="title">Bem-vindo ao CanvaZap</h1>
                    <p className="subtitle">Escolha como você deseja começar sua jornada.</p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: userData?.role === 'super_admin' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    {/* Create Company Option */}
                    <div
                        className="choice-card"
                        onClick={() => navigate('/create-company')}
                        style={{
                            padding: '2rem',
                            borderRadius: '16px',
                            border: '2px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            minHeight: '280px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary-color)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(67, 24, 255, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: 'rgba(67, 24, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-color)',
                            marginBottom: '1.5rem'
                        }}>
                            <Building2 size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Criar minha Empresa</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Sou o dono ou administrador e quero cadastrar uma nova organização.
                        </p>
                    </div>

                    {/* Join Company Option */}
                    <div
                        className="choice-card"
                        onClick={() => navigate('/join-company')}
                        style={{
                            padding: '2rem',
                            borderRadius: '16px',
                            border: '2px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            minHeight: '280px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary-color)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(67, 24, 255, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--success-color)',
                            marginBottom: '1.5rem'
                        }}>
                            <UserPlus size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Me juntar a uma Empresa</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Tenho um código de convite e quero participar de uma organização existente.
                        </p>
                    </div>

                    {/* Master Panel - Only for Super Admin */}
                    {userData?.role === 'super_admin' && (
                        <div
                            className="choice-card"
                            onClick={() => navigate('/admin')}
                            style={{
                                padding: '2rem',
                                borderRadius: '16px',
                                border: '2px solid var(--primary-color)',
                                background: 'linear-gradient(135deg, rgba(67, 24, 255, 0.05) 0%, rgba(67, 24, 255, 0.1) 100%)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                minHeight: '280px',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 32px rgba(67, 24, 255, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Admin
                            </div>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                background: 'var(--primary-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                marginBottom: '1.5rem',
                                boxShadow: '0 8px 16px rgba(67, 24, 255, 0.3)'
                            }}>
                                <Shield size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary-color)' }}>Acessar Painel de Admin</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                Acesso administrativo global para gerenciar todas as empresas do sistema.
                            </p>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        onClick={handleLogout}
                        className="btn btn-secondary"
                        style={{ width: 'auto', margin: '0 auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                    >
                        <LogOut size={16} />
                        Sair e voltar depois
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
