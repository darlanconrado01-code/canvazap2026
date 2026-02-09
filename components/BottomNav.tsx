
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    BookOpen,
    CheckCircle2,
    User,
    Settings,
    ShieldCheck,
    CheckSquare
} from 'lucide-react';
import { useAuth } from './AuthContext';

const BottomNav = () => {
    const { userData } = useAuth();

    // Define items based on role
    const items = [
        { id: 'dashboard', name: 'Home', icon: LayoutDashboard, path: userData?.role === 'super_admin' ? '/admin' : '/' },
    ];

    if (userData?.role === 'super_admin') {
        items.push(
            { id: 'empresas', name: 'Empresas', icon: ShieldCheck, path: '/admin/empresas' },
            { id: 'aprovacoes', name: 'Pendentes', icon: CheckCircle2, path: '/admin/aprovacoes' },
            { id: 'profile', name: 'Perfil', icon: User, path: '/profile' }
        );
    } else {
        // Normal user / company admin
        items.push(
            { id: 'encartes', name: 'Encartes', icon: BookOpen, path: '/encartes' },
            { id: 'artes-postagens', name: 'Artes', icon: CheckCircle2, path: '/artes-postagens' },

            { id: 'profile', name: 'Meu Perfil', icon: User, path: '/profile' }
        );
    }

    return (
        <nav className="bottom-nav">
            <div className="bottom-nav-container">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            <span>{item.name}</span>
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
