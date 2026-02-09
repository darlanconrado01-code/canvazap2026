
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useLayout } from './LayoutContext';
import {
    LayoutDashboard,
    Users,
    Building2,
    LogOut,
    ShieldCheck,
    Palette,
    Clock,
    FileText,
    FlaskConical,
    CheckSquare,
    Tags,
    X,
    Layout,
    Image as ImageIcon,
    BarChart3,
    Mic,
    Bell,
    BookOpen,
    Receipt,
    Wand2,
    Camera,
    CreditCard
} from 'lucide-react';
import { auth, db } from '../services/firebaseConfig';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';

const AdminSidebar = () => {
    const { userData } = useAuth();
    const { isSidebarOpen, setSidebarOpen } = useLayout();

    const [unreadCount, setUnreadCount] = React.useState(0);

    React.useEffect(() => {
        if (userData?.role !== 'super_admin') return;

        const q = query(
            collection(db, 'admin_notifications'),
            where('status', '==', 'unread'),
            limit(10) // We only need enough to show a badge, but count might be more. Actually, better get the count properly.
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [userData]);

    const handleLinkClick = () => {
        if (window.innerWidth < 992) {
            setSidebarOpen(false);
        }
    };

    return (
        <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
            {/* Logo Area */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem 2.5rem 0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h1 className="title" style={{ fontSize: '1.2rem', margin: 0 }}>
                            Painel Master
                        </h1>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>EcoD3 Admin</div>
                    </div>
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
                <div className="sidebar-category">Sistema</div>

                <NavLink to="/admin" end onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Dashboard Global</span>
                </NavLink>



                <NavLink to="/admin/empresas" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Building2 size={20} />
                    <span>Empresas</span>
                </NavLink>

                <NavLink to="/admin/usuarios" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    <span>Usuários Global</span>
                </NavLink>

                <NavLink to="/admin/aprovacoes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Clock size={20} />
                    <span>Aprovações</span>
                </NavLink>

                <NavLink to="/admin/temas" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Palette size={20} />
                    <span>Temas</span>
                </NavLink>

                <NavLink to="/admin/encartes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Layout size={20} />
                    <span>Encartes</span>
                </NavLink>

                <NavLink to="/admin/laminas" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <ImageIcon size={20} />
                    <span>Laminas</span>
                </NavLink>

                <NavLink to="/admin/banco-imagens" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <ImageIcon size={20} />
                    <span>Banco de Imagens</span>
                </NavLink>

                <NavLink to="/admin/relatorio-disparos" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <BarChart3 size={20} />
                    <span>Relatório de Disparos</span>
                </NavLink>

                <NavLink to="/admin/locucoes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Clock size={20} />
                    <span>Pedidos Locução</span>
                </NavLink>

                <NavLink to="/admin/locutores" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Mic size={20} />
                    <span>Banco de Vozes</span>
                </NavLink>

                <NavLink to="/admin/crachas" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <CreditCard size={20} />
                    <span>Gestão de Crachás</span>
                </NavLink>

                <NavLink to="/admin/criacao-artes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} style={{ color: '#8B5CF6' }}>
                    <Wand2 size={20} />
                    <span>Criação de Artes IA</span>
                </NavLink>

                <NavLink to="/admin/merchandise" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Camera size={20} />
                    <span>Merchandising</span>
                </NavLink>

                <NavLink to="/admin/solicitacoes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <FileText size={20} />
                    <span>Solicitações</span>
                </NavLink>

                <NavLink to="/admin/notificacoes" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Bell size={20} />
                    <span style={{ flex: 1 }}>Notificações</span>
                    {unreadCount > 0 && (
                        <span style={{
                            background: '#ef4444',
                            color: 'white',
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            minWidth: '18px',
                            textAlign: 'center'
                        }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </NavLink>


                <NavLink to="/admin/categorias" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Tags size={20} />
                    <span>Categorias de Negócio</span>
                </NavLink>

                <NavLink to="/admin/orcamentos" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <Receipt size={20} />
                    <span>Orçamentos</span>
                </NavLink>

                <NavLink to="/admin/tutoriais" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <BookOpen size={20} />
                    <span>Tutoriais</span>
                </NavLink>



                <div className="sidebar-category" style={{ marginTop: '1.5rem' }}>Debug</div>
                <NavLink to="/admin/debug" onClick={handleLinkClick} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} style={{ color: '#F59E0B' }}>
                    <FlaskConical size={20} />
                    <span>Diagnóstico Firestore</span>
                </NavLink>
            </nav>

            {/* Footer / Logout */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <NavLink to="/" onClick={handleLinkClick} className="sidebar-link" style={{ marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
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
