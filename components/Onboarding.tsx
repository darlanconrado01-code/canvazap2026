
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserPlus, LogOut } from 'lucide-react';
import { auth } from '../services/firebaseConfig';

const Onboarding = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div className="auth-container">
            <div className="glass-card fade-in" style={{ maxWidth: '800px' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 className="title">Bem-vindo ao CanvaZap</h1>
                    <p className="subtitle">Escolha como você deseja começar sua jornada.</p>
                </div>

                <div className="choice-grid">
                    {/* Create Company Option */}
                    <div className="choice-card" onClick={() => navigate('/create-company')}>
                        <div className="choice-icon">
                            <Building2 size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Criar minha Empresa</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Sou o dono ou administrador e quero cadastrar uma nova organização.
                        </p>
                    </div>

                    {/* Join Company Option */}
                    <div className="choice-card" onClick={() => navigate('/join-company')}>
                        <div className="choice-icon">
                            <UserPlus size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Me juntar a uma Empresa</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Tenho um código de convite e quero participar de uma organização existente.
                        </p>
                    </div>
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
