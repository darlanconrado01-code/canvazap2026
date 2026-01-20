
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, User as UserIcon, LogOut, ChevronDown, Building2 } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const TopBar = () => {
    const { userData, switchCompany } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // State for company name and switcher
    const [companyName, setCompanyName] = useState('');
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);

    useEffect(() => {
        const fetchCompanyName = async () => {
            if (userData?.companyId) {
                // Try to find name in membership first (optimization)
                const membership = userData.memberships?.find(m => m.companyId === userData.companyId);
                if (membership?.companyName) {
                    setCompanyName(membership.companyName);
                } else {
                    // Fallback fetch
                    const docSnap = await getDoc(doc(db, 'companies', userData.companyId));
                    if (docSnap.exists()) {
                        setCompanyName(docSnap.data().name);
                    }
                }
            }
        };
        fetchCompanyName();
    }, [userData]);

    // Mapping path to Title
    const getTitle = (pathname: string) => {
        switch (pathname) {
            case '/': return 'Dashboard';
            case '/laminas': return 'Lâminas';
            case '/laminas-plus': return 'Lâminas Plus';
            case '/banco-imagens': return 'Banco de Imagens';
            case '/encartes': return 'Encartes';
            case '/crachas': return 'Crachás';
            case '/temas': return 'Temas';
            case '/usuarios': return 'Gerenciamento de Usuários';
            case '/profile': return 'Meu Perfil';
            default: return 'CanvaZap';
        }
    };

    const hasMultipleCompanies = (userData?.memberships?.length || 0) > 1;

    return (
        <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            padding: '1rem 0',
        }}>
            {/* Left: Breadcrumbs/Title */}
            <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Módulos / {getTitle(location.pathname)}</div>
                <h2 className="title" style={{ fontSize: '2rem', marginTop: '0.2rem' }}>{getTitle(location.pathname)}</h2>
            </div>

            {/* Right: Search, Notifs, Profile */}
            <div style={{
                background: 'var(--surface-color)',
                padding: '0.5rem',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: 'var(--card-shadow)'
            }}>
                {/* Search Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-color)',
                    borderRadius: '20px',
                    padding: '0.5rem 1rem',
                    width: '240px'
                }}>
                    <Search size={16} color="var(--text-secondary)" />
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        style={{
                            border: 'none',
                            background: 'transparent',
                            marginLeft: '0.5rem',
                            fontSize: '0.9rem',
                            outline: 'none',
                            color: 'var(--text-color)',
                            width: '100%'
                        }}
                    />
                </div>

                {/* Icons */}
                <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '0.5rem' }}>
                    <Bell size={20} />
                </button>

                {/* Company Switcher / Profile Pill */}
                <div style={{ position: 'relative' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.8rem',
                            padding: '0.2rem 0.5rem 0.2rem 0.2rem',
                            cursor: 'pointer'
                        }}
                        onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                    >
                        {userData?.photoUrl ? (
                            <img src={userData.photoUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserIcon size={20} />
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', marginRight: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-color)' }}>
                                {userData?.displayName?.split(' ')[0]}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {companyName || (userData?.role === 'admin' ? 'Admin' : 'Membro')}
                                {hasMultipleCompanies && <ChevronDown size={12} />}
                            </span>
                        </div>
                    </div>

                    {showCompanyMenu && (
                        <div className="glass-card" style={{
                            position: 'absolute',
                            top: '120%',
                            right: 0,
                            width: '240px',
                            padding: '0.5rem',
                            zIndex: 100,
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {hasMultipleCompanies && (
                                <>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                                        TROCAR DE EMPRESA
                                    </div>
                                    {userData?.memberships?.map(m => (
                                        <button
                                            key={m.companyId}
                                            onClick={() => {
                                                switchCompany(m.companyId);
                                                setShowCompanyMenu(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem',
                                                padding: '0.8rem',
                                                border: 'none',
                                                background: m.companyId === userData.companyId ? 'var(--bg-color)' : 'transparent',
                                                color: m.companyId === userData.companyId ? 'var(--primary-color)' : 'var(--text-color)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <Building2 size={16} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600 }}>{m.companyName || 'Empresa...'}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{m.role === 'admin' ? 'Administrador' : 'Membro'}</span>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                <button
                                    onClick={() => navigate('/onboarding')}
                                    style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    + Nova Empresa / Entrar
                                </button>

                                {userData?.role === 'admin' && (
                                    <button
                                        onClick={() => navigate('/company-profile')}
                                        style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Building2 size={14} /> Perfil da Empresa
                                    </button>
                                )}
                                <button
                                    onClick={() => navigate('/profile')}
                                    style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <UserIcon size={14} /> Meu Perfil
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header >
    );
};

export default TopBar;
