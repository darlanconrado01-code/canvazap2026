
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useLayout } from './LayoutContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, User as UserIcon, LogOut, ChevronDown, Building2, Plus, Menu, ChevronLeft } from 'lucide-react';
import { db, auth } from '../services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import VoiceAssistant from './VoiceAssistant';

const TopBar = () => {
    const { userData, switchCompany, stopImpersonation, user } = useAuth();
    const { toggleSidebar } = useLayout();
    const location = useLocation();
    const navigate = useNavigate();

    // State for company name and switcher
    const [companyName, setCompanyName] = useState('');
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);

    useEffect(() => {
        const fetchCompanyName = async () => {
            if (userData?.role === 'super_admin') {
                setCompanyName('Painel Master');
                return;
            }

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
        if (pathname === '/admin') return 'Dashboard Global';
        if (pathname === '/admin/empresas') return 'Gestão de Empresas';
        if (pathname === '/admin/usuarios') return 'Gerenciamento Global de Usuários';
        if (pathname === '/admin/aprovacoes') return 'Aprovações de Pendências';

        switch (pathname) {
            case '/': return 'Dashboard';
            case '/laminas': return 'Lâminas';
            case '/laminas-plus': return 'Lâminas Plus';
            case '/banco-imagens': return 'Banco de Imagens';
            case '/encartes': return 'Encartes';
            case '/crachas': return 'Crachás';
            case '/temas': return 'Temas';
            case '/usuarios': return 'Membros da Equipe';
            case '/profile': return 'Meu Perfil';
            case '/company-profile': return 'Perfil da Empresa';
            case '/tarefas': return 'Tarefas';
            case '/solicitacoes': return 'Solicitações';
            case '/artes-postagens': return 'Aprovação de Artes';
            default: return 'EcoD3';
        }
    };

    const hasMultipleCompanies = (userData?.memberships?.length || 0) > 1;
    const isImpersonating = sessionStorage.getItem('impersonatedUid') !== null;

    return (
        <div style={{ width: '100%' }}>
            {isImpersonating && (
                <div style={{
                    background: 'linear-gradient(90deg, #FF4B2B 0%, #FF416C 100%)',
                    color: 'white',
                    padding: '0.5rem 1.5rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 12px rgba(255, 65, 108, 0.2)'
                }}>
                    <span style={{ fontSize: '0.75rem' }}>⚠️ MODO DE VISUALIZAÇÃO: <strong>{userData?.displayName}</strong></span>
                    <button
                        onClick={() => {
                            stopImpersonation();
                            navigate('/admin/usuarios');
                        }}
                        style={{
                            background: 'white',
                            color: '#FF416C',
                            border: 'none',
                            padding: '3px 12px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        Sair
                    </button>
                </div>
            )}

            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                padding: '0.5rem 0',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                {/* Left: Breadcrumbs/Title + Hamburger */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {location.pathname !== '/' && location.pathname !== '/admin' ? (
                        <button
                            onClick={() => navigate(-1)}
                            style={{ background: 'white', border: '1px solid var(--border-color)', padding: '6px', borderRadius: '8px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    ) : (
                        <button
                            className="mobile-menu-btn"
                            onClick={toggleSidebar}
                            style={{ padding: '6px' }}
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <div>
                        <div className="hide-mobile" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Módulos / {getTitle(location.pathname)}</div>
                        <h2 className="title" style={{ fontSize: '1.2rem', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'clamp(100px, 30vw, 200px)' }}>
                            {getTitle(location.pathname)}
                        </h2>
                    </div>
                </div>

                {/* Right: Search, Notifs, Profile */}
                <div style={{
                    background: 'var(--surface-color)',
                    padding: '0.4rem',
                    borderRadius: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: 'var(--card-shadow)',
                    marginLeft: 'auto'
                }}>
                    {/* Search Bar - Hidden on small mobile */}
                    <div className="search-bar-wrapper" style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-color)',
                        borderRadius: '20px',
                        padding: '0.4rem 0.8rem',
                        width: 'clamp(100px, 20vw, 240px)'
                    }}>
                        <Search size={14} color="var(--text-secondary)" />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            style={{
                                border: 'none',
                                background: 'transparent',
                                marginLeft: '0.4rem',
                                fontSize: '0.85rem',
                                outline: 'none',
                                color: 'var(--text-color)',
                                width: '100%'
                            }}
                        />
                    </div>

                    {/* Icons */}
                    <VoiceAssistant />

                    <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '0.4rem', display: 'flex', alignItems: 'center' }}>
                        <Bell size={18} />
                    </button>

                    {/* Company Switcher / Profile Pill */}
                    <div style={{ position: 'relative' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.2rem',
                                cursor: 'pointer'
                            }}
                            onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                        >
                            {userData?.photoUrl ? (
                                <img src={userData.photoUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserIcon size={16} />
                                </div>
                            )}
                            <div style={{ display: 'none', flexDirection: 'column', marginRight: '0.4rem' }} className="user-name-wrapper">
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {userData?.displayName?.split(' ')[0]}
                                </span>
                            </div>
                            <ChevronDown size={14} color="var(--text-secondary)" />
                        </div>

                        {showCompanyMenu && (
                            <div className="glass-card" style={{
                                position: 'absolute',
                                top: '120%',
                                right: 0,
                                width: '240px',
                                padding: '0.5rem',
                                zIndex: 1100,
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{userData?.displayName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{userData?.email}</div>
                                </div>
                                {hasMultipleCompanies && (
                                    <>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                            Trocar Empresa
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
                                                    gap: '0.6rem',
                                                    padding: '0.6rem',
                                                    border: 'none',
                                                    background: m.companyId === userData.companyId ? 'var(--bg-color)' : 'transparent',
                                                    color: m.companyId === userData.companyId ? 'var(--primary-color)' : 'var(--text-color)',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                <Building2 size={14} />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600 }}>{m.companyName || 'Empresa...'}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}
                                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                    <button
                                        onClick={() => { navigate('/'); setShowCompanyMenu(false); }}
                                        style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        🏠 Início
                                    </button>

                                    {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                                        <button
                                            onClick={() => { navigate('/company-profile'); setShowCompanyMenu(false); }}
                                            style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <Building2 size={14} /> Perfil da Empresa
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { navigate('/profile'); setShowCompanyMenu(false); }}
                                        style={{ width: '100%', padding: '0.5rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <UserIcon size={14} /> Meu Perfil
                                    </button>

                                    <button
                                        onClick={() => { navigate('/create-company'); setShowCompanyMenu(false); }}
                                        style={{ width: '100%', padding: '0.5rem', color: 'var(--primary-color)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
                                    >
                                        <Plus size={14} /> Nova Empresa
                                    </button>

                                    <button
                                        onClick={() => auth.signOut()}
                                        style={{ width: '100%', padding: '0.5rem', color: 'var(--error-color)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                                    >
                                        <LogOut size={14} /> Sair
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <style>{`
                @media (min-width: 640px) {
                    .user-name-wrapper { display: flex !important; }
                }
                @media (max-width: 480px) {
                    .search-bar-wrapper { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default TopBar;
