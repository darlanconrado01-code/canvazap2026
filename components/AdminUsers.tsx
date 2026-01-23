
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { auth as firebaseAuth } from '../services/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
    User as UserIcon,
    Search,
    Filter,
    Building2,
    Shield,
    XCircle,
    Loader2,
    Key,
    UserPlus,
    X,
    Eye
} from 'lucide-react';

const AdminUsers = () => {
    const { userData, impersonateUser } = useAuth();
    const [allCompanies, setAllCompanies] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [companyFilter, setCompanyFilter] = useState('all');

    // Manual Add State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({ uid: '', displayName: '', email: '' });

    // Password Reset State
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUser, setResetUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState('');

    // Add to Company State
    const [showAddToCompanyModal, setShowAddToCompanyModal] = useState(false);
    const [targetUser, setTargetUser] = useState<any>(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');

    // Status message for actions
    const [actionLoading, setActionLoading] = useState(false);

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
        } catch (e: any) {
            console.error("FIRESTORE ERROR (fetchData AdminUsers)", {
                code: e?.code,
                message: e?.message,
                uid: firebaseAuth.currentUser?.uid
            });
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                <h3>Erro ao carregar usuários</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{error.code}: {error.message}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>Recarregar</button>
            </div>
        );
    }

    const filteredUsers = users.filter((u: any) => {
        const nameMatch = (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter === 'all' || (u.status || 'active') === statusFilter;

        // Filter by company: check top level companyId or inside memberships array
        let companyMatch = companyFilter === 'all';
        if (!companyMatch) {
            if (companyFilter === 'null') {
                companyMatch = !u.companyId && (!u.memberships || u.memberships.length === 0);
            } else {
                const isInMemberships = (u.memberships || []).some((m: any) => m.companyId === companyFilter);
                companyMatch = u.companyId === companyFilter || isInMemberships;
            }
        }

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="title" style={{ fontSize: '1.4rem', margin: 0 }}>
                    Usuários Totais do Sistema ({filteredUsers.length})
                </h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <UserIcon size={18} />
                    Adicionar Usuário Manual
                </button>
            </div>

            {/* Modal de Adição Manual */}
            {showAddModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }}>
                    <div className="glass-card fade-in" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
                        <button
                            onClick={() => setShowAddModal(false)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <XCircle size={24} />
                        </button>

                        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Forçar Cadastro de Usuário</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Use isto para criar o perfil no banco de dados de um usuário que já existe no Firebase Auth ou que foi criado manualmente.
                        </p>

                        <div className="form-group">
                            <label className="form-label">UID do Usuário (do Console Firebase)</label>
                            <input
                                type="text" className="form-input"
                                placeholder="Copia do console do Firebase..."
                                value={newUser.uid}
                                onChange={e => setNewUser({ ...newUser, uid: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nome Completo</label>
                            <input
                                type="text" className="form-input"
                                placeholder="Ex: Alan Deivid"
                                value={newUser.displayName}
                                onChange={e => setNewUser({ ...newUser, displayName: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">E-mail</label>
                            <input
                                type="email" className="form-input"
                                placeholder="email@exemplo.com"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    const uidTrimmed = newUser.uid.trim();
                                    const emailTrimmed = newUser.email.trim();

                                    if (!uidTrimmed || !emailTrimmed) return alert('UID e E-mail são obrigatórios');

                                    try {
                                        await setDoc(doc(db, 'users', uidTrimmed), {
                                            ...newUser,
                                            uid: uidTrimmed,
                                            email: emailTrimmed,
                                            createdAt: new Date(),
                                            status: 'active'
                                        });
                                        alert('Usuário sincronizado com sucesso!');
                                        setShowAddModal(false);
                                        fetchData();
                                    } catch (err: any) {
                                        console.error('❌ [AdminUsers] Sync Error:', {
                                            code: err?.code,
                                            message: err?.message,
                                            targetUid: uidTrimmed,
                                            adminUid: firebaseAuth.currentUser?.uid
                                        });
                                        alert(`Erro ao sincronizar: [${err.code}] ${err.message}`);
                                    }
                                }}
                            >
                                Sincronizar Agora
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Redefinição de Senha */}
            {showResetModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }}>
                    <div className="glass-card fade-in" style={{ maxWidth: '400px', width: '100%', position: 'relative' }}>
                        <button
                            onClick={() => setShowResetModal(false)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Redefinir Senha</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Redefinindo senha para: <strong>{resetUser?.displayName}</strong>
                        </p>

                        <div className="form-group">
                            <label className="form-label">Nova Senha</label>
                            <input
                                type="password" className="form-input"
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                disabled={actionLoading}
                                onClick={async () => {
                                    if (newPassword.length < 6) return alert('A senha deve ter pelo menos 6 caracteres');
                                    // Note: Client side cannot directly change other users passwords
                                    // but we can send a reset email which is the safest way
                                    setActionLoading(true);
                                    try {
                                        await sendPasswordResetEmail(firebaseAuth, resetUser.email);
                                        alert(`E-mail de redefinição de senha enviado para ${resetUser.email}`);
                                        setShowResetModal(false);
                                        setNewPassword('');
                                    } catch (err: any) {
                                        console.error(err);
                                        alert('Erro ao enviar e-mail: ' + err.message);
                                    } finally {
                                        setActionLoading(false);
                                    }
                                }}
                            >
                                {actionLoading ? 'Enviando...' : 'Enviar E-mail de Redefinição'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar à Empresa */}
            {showAddToCompanyModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }}>
                    <div className="glass-card fade-in" style={{ maxWidth: '450px', width: '100%', position: 'relative' }}>
                        <button
                            onClick={() => setShowAddToCompanyModal(false)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>

                        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Vincular a Empresa</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Adicionar <strong>{targetUser?.displayName}</strong> a uma organização.
                        </p>

                        <div className="form-group">
                            <label className="form-label">Selecionar Empresa</label>
                            <select
                                className="form-input"
                                value={selectedCompanyId}
                                onChange={e => setSelectedCompanyId(e.target.value)}
                            >
                                <option value="">Selecione uma empresa...</option>
                                {allCompanies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Papel na Empresa</label>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="radio" checked={selectedRole === 'member'} onChange={() => setSelectedRole('member')} /> Membro
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="radio" checked={selectedRole === 'admin'} onChange={() => setSelectedRole('admin')} /> Administrador
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-primary"
                                disabled={actionLoading}
                                onClick={async () => {
                                    if (!selectedCompanyId) return alert('Selecione uma empresa');
                                    try {
                                        setActionLoading(true);
                                        const company = allCompanies.find(c => c.id === selectedCompanyId);
                                        const userRef = doc(db, 'users', targetUser.uid);

                                        const membership = {
                                            companyId: selectedCompanyId,
                                            companyName: company?.name,
                                            role: selectedRole,
                                            status: 'active'
                                        };

                                        await updateDoc(userRef, {
                                            companyId: selectedCompanyId,
                                            currentCompanyId: selectedCompanyId, // Add this for consistency
                                            role: selectedRole,
                                            status: 'active',
                                            memberships: Array.isArray(targetUser.memberships)
                                                ? [...targetUser.memberships.filter((m: any) => m.companyId !== selectedCompanyId), membership]
                                                : [membership]
                                        });

                                        // Update company member list for rules compatibility
                                        try {
                                            await updateDoc(doc(db, 'companies', selectedCompanyId), {
                                                memberUids: arrayUnion(targetUser.uid)
                                            });
                                        } catch (e) {
                                            console.warn('Could not update company memberUids:', e);
                                        }

                                        alert(`${targetUser.displayName} vinculado a ${company?.name} com sucesso!`);
                                        setShowAddToCompanyModal(false);
                                        fetchData();
                                    } catch (err: any) {
                                        console.error(err);
                                        alert('Erro ao vincular: ' + err.message);
                                    } finally {
                                        setActionLoading(false);
                                    }
                                }}
                            >
                                {actionLoading ? 'Processando...' : 'Confirmar Vínculo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {u.memberships && u.memberships.length > 0 ? (
                                                u.memberships.map((m: any) => (
                                                    <div key={m.companyId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                        <Building2 size={12} className="text-primary" />
                                                        <span style={{ fontWeight: 500 }}>{m.companyName || allCompanies.find(c => c.id === m.companyId)?.name || 'Empresa...'}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                userCompany ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Building2 size={14} className="text-primary" />
                                                        <span style={{ fontWeight: 500 }}>{userCompany.name}</span>
                                                    </div>
                                                ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Nenhuma</span>
                                            )}
                                        </div>
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
                                            <button
                                                title="Visualizar como este usuário (Impersonate)"
                                                onClick={() => impersonateUser(u.uid)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                            >
                                                <Eye size={18} />
                                            </button>

                                            <button title="Redefinir Senha" onClick={() => {
                                                setResetUser(u);
                                                setShowResetModal(true);
                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}><Key size={18} /></button>

                                            <button title="Adicionar à Empresa" onClick={() => {
                                                setTargetUser(u);
                                                setSelectedCompanyId(u.companyId || '');
                                                setShowAddToCompanyModal(true);
                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success-color)' }}><UserPlus size={18} /></button>

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
