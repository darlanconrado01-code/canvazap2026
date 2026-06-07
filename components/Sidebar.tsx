
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useLayout } from './LayoutContext';
import {
    LogOut,
    Building2,
    X,
    BookOpen
} from 'lucide-react';
import { auth } from '../services/firebaseConfig';
import { MODULES } from './SidebarMenu';

// We can refine grouping logic here
const MENU_GROUPS = [
    {
        title: 'Geral',
        items: ['dashboard', 'tutoriais']
    },
    {
        title: 'Artes & Mídia',
        items: ['laminas', 'artes-vagas', 'encartes', 'catalogos', 'artes-postagens', 'banco-imagens', 'temas']
    },
    {
        title: 'Administrativo',
        items: ['crachas', 'locucoes', 'transcrever-zap', 'crm', 'usuarios', 'solicitacoes', 'tarefas', 'disparos-petville']
    }
];

const Sidebar = () => {
    const { userData } = useAuth();
    const { isSidebarOpen, setSidebarOpen } = useLayout();

    const hasAccess = (moduleId: string) => {
        if (!userData) return false;

        const moduleDefs = MODULES.find(m => m.id === moduleId);
        if (!moduleDefs) return false;

        if (moduleDefs.superAdminOnly) return false;

        // 1. Check if COMPANY has access to this module
        // For 'catalogos', we inherit access from 'encartes' to avoid breaking existing users
        const effectiveModuleId = moduleId === 'catalogos' ? 'encartes' : moduleId;
        const isDefaultModule = moduleId === 'dashboard' || moduleId === 'tutoriais';
        if (!isDefaultModule && userData.companyModules && !userData.companyModules.includes(effectiveModuleId)) {
            return false;
        }

        // 2. User level checks
        if (userData.isOwner || userData.role === 'admin' || userData.role === 'super_admin') return true;

        // Basic dashboard access
        if (moduleId === 'dashboard') return true;

        // For all other modules, respect the selection
        return userData.allowedModules?.includes(effectiveModuleId);
    };

    const handleLinkClick = () => {
        // Close sidebar on mobile after clicking a link
        if (window.innerWidth < 992) {
            setSidebarOpen(false);
        }
    };

    return (
        <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
            {/* Logo Area */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem 2.5rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>E</div>
                    <h1 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>
                        EcoD3
                    </h1>
                </div>

                {/* Close Button for Mobile */}
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="mobile-menu-btn"
                    style={{ border: 'none', background: 'transparent' }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>

                {MENU_GROUPS.map((group) => {
                    // Filter items that exist and user has access to
                    const visibleItems = group.items
                        .map(id => MODULES.find(m => m.id === id))
                        .filter(m => m && hasAccess(m.id));

                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={group.title}>
                            <div className="sidebar-category">{group.title}</div>
                            {visibleItems.map(module => {
                                const Icon = module!.icon;
                                return (
                                    <NavLink
                                        key={module!.id}
                                        to={module!.path}
                                        onClick={handleLinkClick}
                                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                    >
                                        <Icon size={20} />
                                        <span>{module!.name}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    );
                })}

                {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                    <div style={{ marginTop: '1rem' }}>
                        <div className="sidebar-category">Configurações</div>
                        <NavLink to="/company-profile" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <Building2 size={20} />
                            <span>Perfil da Empresa</span>
                        </NavLink>
                    </div>
                )}

            </nav>

            {/* Footer / Logout */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                {userData?.role === 'super_admin' && (
                    <NavLink to="/admin" onClick={handleLinkClick} className="sidebar-link" style={{ marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
                        <span>Painel Master</span>
                    </NavLink>
                )}
                {userData?.companySubscription && (
                    <div className="glass-card" style={{ padding: '0.8rem', margin: '0 0.5rem 1rem 0.5rem', background: 'rgba(67, 24, 255, 0.05)', border: '1px solid rgba(67, 24, 255, 0.1)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '2px' }}>Assinatura</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                {userData.companySubscription.plan === 'vitalicio' ? 'Vitalícia ✨' :
                                    userData.companySubscription.plan === 'annual' ? 'Anual' :
                                        userData.companySubscription.plan === 'fixed_days' ? 'Personalizada' : 'Mensal'}
                            </span>
                            {userData.companySubscription.plan !== 'vitalicio' && userData.companySubscription.expiryDate && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {(() => {
                                        const expiry = userData.companySubscription.expiryDate.toDate ? userData.companySubscription.expiryDate.toDate() : new Date(userData.companySubscription.expiryDate);
                                        const days = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                        return days > 0 ? `${days} dias` : 'Expirado';
                                    })()}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => auth.signOut()}
                    className="sidebar-link"
                    style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    <LogOut size={20} />
                    <span>Sair da Conta</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
