
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    User as UserIcon,
    Search,
    Filter,
    Building2,
    Shield,
    XCircle,
    Loader2
} from 'lucide-react';

const AdminUsers = () => {
    const { userData } = useAuth();
    const [allCompanies, setAllCompanies] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch All Companies
            const compSnap = await getDocs(collection(db, 'companies'));
            const compData = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllCompanies(compData);

            // Fetch All Users
            const userSnap = await getDocs(collection(db, 'users'));
            const allUsersData = userSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setUsers(allUsersData);
        } catch (error) {
            console.error("Error fetching admin users:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter((u: any) => {
        const nameMatch = (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter === 'all' || (u.status || 'active') === statusFilter;
        const companyMatch = companyFilter === 'all' || u.companyId === companyFilter;
        return nameMatch && statusMatch && companyMatch;
    });

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <Loader2 className="loading-spinner" size={48} />
        </div>
    );

    return (
        <div className="fade-in">
            <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={20} className="text-primary" />
                    Filtros Globais de Usuários
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Pesquisar Nome ou E-mail</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="João Silva..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Filtrar por Empresa</label>
                        <select className="form-input" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                            <option value="all">Todas as Empresas</option>
                            <option value="null">Sem Empresa</option>
                            {allCompanies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Todos os Status</option>
                            <option value="active">Ativos</option>
                            <option value="pending">Pendentes</option>
                        </select>
                    </div>
                </div>
            </div>

            <h3 className="title" style={{ marginBottom: '1rem', fontSize: '1.4rem' }}>
                Usuários Totais do Sistema ({filteredUsers.length})
            </h3>

            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Usuário</th>
                            <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Empresa</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Papel</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => {
                            const userCompany = allCompanies.find(c => c.id === u.companyId);
                            const isOwner = userCompany?.ownerId === u.uid;

                            return (
                                <tr key={u.uid} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#ccc' }}>
                                                {u.photoUrl ? <img src={u.photoUrl} alt="" style={{ width: '100%', height: '100%' }} /> : <UserIcon size={16} style={{ margin: 8 }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{u.displayName || 'Sem Nome'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {userCompany ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Building2 size={14} className="text-primary" />
                                                <span style={{ fontWeight: 500 }}>{userCompany.name}</span>
                                            </div>
                                        ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nenhuma</span>}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        {u.role === 'super_admin' ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: '#000', color: '#fff' }}>
                                                SUPER ADMIN
                                            </span>
                                        ) : isOwner ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                                DONO
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: u.role === 'admin' ? 'rgba(67, 24, 255, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: u.role === 'admin' ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                                                {u.role || 'membro'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: (u.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)'), color: (u.status === 'pending' ? '#F59E0B' : 'var(--success-color)') }}>
                                            {(u.status || 'active').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                            <button title="Tornar Super Admin" onClick={async () => {
                                                if (confirm('Deseja dar poderes de Super Admin a este usuário?')) {
                                                    await updateDoc(doc(db, 'users', u.uid), { isSystemAdmin: true });
                                                    fetchData();
                                                }
                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'gold' }}>< Shield size={18} /></button>
                                            <button title="Excluir Usuário" onClick={async () => {
                                                if (confirm(`Tem certeza que deseja excluir o usuário ${u.displayName}? Esta ação é irreversível.`)) {
                                                    try {
                                                        await deleteDoc(doc(db, 'users', u.uid));
                                                        setUsers(prev => prev.filter(usr => usr.uid !== u.uid));
                                                        alert('Usuário excluído com sucesso.');
                                                    } catch (error) {
                                                        console.error("Erro ao excluir usuário:", error);
                                                        alert('Erro ao excluir usuário.');
                                                    }
                                                }
                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)' }}><XCircle size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
