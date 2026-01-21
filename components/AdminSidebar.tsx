import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
    LayoutDashboard,
    Users,
    Building2,
    LogOut,
    ShieldCheck,
    Palette
} from 'lucide-react';
import { auth } from '../services/firebaseConfig';

const AdminSidebar = () => {
    const { userData } = useAuth();

    return (
        <aside
            style={{
                width: '290px',
                backgroundColor: 'var(--surface-color)',
                borderRight: '1px solid var(--border-color)',
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
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    <ShieldCheck size={20} />
                </div>
                <div>
                    <h1 className="title" style={{ fontSize: '1.2rem', margin: 0 }}>
                        Painel Master
                    </h1>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>CanvaZap Admin</div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto' }}>
                <div className="sidebar-category">Sistema</div>

                <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard Global</span>
                </NavLink>

                <NavLink to="/admin/empresas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Building2 size={20} />
                    <span>Empresas</span>
                </NavLink>

                <NavLink to="/admin/usuarios" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    <span>Usuários Global</span>
                </NavLink>

                <NavLink to="/admin/temas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Palette size={20} />
                    <span>Temas</span>
                </NavLink>
            </nav>

            {/* Footer / Logout */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <NavLink to="/" className="sidebar-link" style={{ marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
                    <span>Voltar ao App</span>
                </NavLink>
                <button
                    onClick={() => auth.signOut()}
                    className="sidebar-link"
                    style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    <LogOut size={20} />
                    <span>Sair do Sistema</span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
