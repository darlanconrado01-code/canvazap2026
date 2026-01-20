
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
    LayoutDashboard,
    FileImage,
    Layers,
    Image,
    BookOpen,
    CreditCard,
    Palette,
    Users,
    LogOut,
    Inbox,
    Settings
} from 'lucide-react';
import { auth } from '../services/firebaseConfig';
// import { MODULES } from './Sidebar'; // Removed circular import

export const MODULES = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'laminas', name: 'Lâminas', icon: FileImage, path: '/laminas' },
    { id: 'laminas-plus', name: 'Lâminas Plus', icon: Layers, path: '/laminas-plus' },
    { id: 'banco-imagens', name: 'Banco de Imagens', icon: Image, path: '/banco-imagens' },
    { id: 'encartes', name: 'Encartes', icon: BookOpen, path: '/encartes' },
    { id: 'crachas', name: 'Crachás', icon: CreditCard, path: '/crachas' },
    { id: 'temas', name: 'Temas', icon: Palette, path: '/temas' },
    { id: 'usuarios', name: 'Usuários', icon: Users, path: '/usuarios', adminOnly: true },
    { id: 'solicitacoes', name: 'Solicitações de Imagens', icon: Inbox, path: '/solicitacoes', adminOnly: true },
];

// We can refine grouping logic here
const MENU_GROUPS = [
    {
        title: 'Geral',
        items: ['dashboard']
    },
    {
        title: 'Artes & Mídia',
        items: ['laminas', 'laminas-plus', 'encartes', 'banco-imagens', 'temas']
    },
    {
        title: 'Administrativo',
        items: ['crachas', 'usuarios', 'solicitacoes']
    }
];

const Sidebar = () => {
    const { userData } = useAuth();

    const hasAccess = (moduleId: string) => {
        if (!userData) return false;
        const moduleDefs = MODULES.find(m => m.id === moduleId);
        if (!moduleDefs) return false;

        if (userData.role === 'admin') return true;
        if (moduleDefs.adminOnly) return false;
        if (moduleId === 'dashboard') return true;
        return userData.allowedModules?.includes(moduleId);
    };

    return (
        <aside
            style={{
                width: '290px',
                backgroundColor: 'var(--surface-color)',
                borderRight: '1px solid var(--border-color)', // Clean border instead of gap
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem 1.5rem',
                height: '100vh',
                position: 'sticky',
                top: 0
            }}
        >
            {/* Logo Area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0 0.5rem 2.5rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>C</div>
                <h1 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>
                    CanvaZap
                </h1>
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

            </nav>

            {/* Footer / Logout */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
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

// Re-export the MODULES definition for consistency


export default Sidebar;
