
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import {
    Copy,
    Check,
    UserPlus,
    Mail,
    Shield,
    User as UserIcon,
    MoreVertical,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';
import { MODULES } from './Sidebar';

const UsersModule = () => {
    const { userData } = useAuth();
    const [company, setCompany] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]); // Active users
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Invite State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState('');

    // Copy State
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchData();
    }, [userData]);

    const fetchData = async () => {
        if (!userData?.companyId) return;
        setLoading(true);

        try {
            // Fetch Company Details (for Code)
            const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
            if (companyDoc.exists()) {
                setCompany(companyDoc.data());
            }

            // Fetch Users
            const q = query(collection(db, 'users'), where('companyId', '==', userData.companyId));
            const querySnapshot = await getDocs(q);
            const allUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            setUsers(allUsers.filter((u: any) => u.status === 'active' || u.status === undefined)); // Assuming undefined is effectively active legacy
            setPendingUsers(allUsers.filter((u: any) => u.status === 'pending'));

        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/join-company?code=${company?.code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApprove = async (uid: string) => {
        try {
            await updateDoc(doc(db, 'users', uid), {
                status: 'active'
            });
            fetchData(); // Refresh list
        } catch (error) {
            console.error(error);
        }
    };

    const handleReject = async (uid: string) => {
        try {
            // Remove companyId from user to effectively "reject" them from this view
            await updateDoc(doc(db, 'users', uid), {
                companyId: null,
                status: null,
                role: null
            });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteSuccess('');

        try {
            // Check if user exists already
            const q = query(collection(db, 'users'), where('email', '==', inviteEmail));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // User exists, add them directly if they don't have a company?
                // Or just update them. For this demo, let's update them if they are "free".
                const targetUser = snapshot.docs[0];
                const targetUserData = targetUser.data();

                if (targetUserData.companyId && targetUserData.companyId !== userData?.companyId) {
                    setInviteSuccess('Usuário já pertence a outra empresa.');
                } else {
                    await updateDoc(doc(db, 'users', targetUser.id), {
                        companyId: userData!.companyId,
                        role: inviteRole,
                        status: 'active' // Direct approval
                    });
                    setInviteSuccess('Usuário adicionado com sucesso!');
                    fetchData();
                }
            } else {
                // User doesn't exist. Create an "Invitation" record (optional, or just mock success)
                // Real-world: Send email via Cloud Function.
                // Here: We'll just visually confirm.
                setInviteSuccess(`Convite enviado para ${inviteEmail} (Simulado).`);
            }
            setInviteEmail('');
        } catch (error) {
            console.error(error);
            setInviteSuccess('Erro ao processar convite.');
        } finally {
            setInviteLoading(false);
        }
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div className="fade-in">
            {/* Header Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Invite Link Card */}
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserPlus size={20} className="text-primary" />
                        Repassar Link de Convite
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Compartilhe este link ou código para que pessoas solicitem entrada.
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{
                            flex: 1, background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '8px',
                            fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span>{company?.code}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CÓDIGO</span>
                        </div>
                    </div>

                    <button
                        onClick={handleCopyLink}
                        className={copied ? "btn" : "btn btn-primary"}
                        style={{ backgroundColor: copied ? 'var(--success-color)' : '' }}
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copiado!' : 'Copiar Link de Convite'}
                    </button>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {window.location.origin}/join-company?code={company?.code}
                    </div>
                </div>

                {/* Direct Invite Card */}
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={20} className="text-primary" />
                        Convidar por E-mail
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Adicione membros diretamente. Se eles já tiverem conta, serão adicionados automaticamente.
                    </p>

                    <form onSubmit={handleInvite}>
                        <div className="form-group">
                            <input
                                type="email"
                                className="form-input"
                                placeholder="E-mail do colaborador"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="member"
                                    checked={inviteRole === 'member'}
                                    onChange={() => setInviteRole('member')}
                                />
                                Membro
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="admin"
                                    checked={inviteRole === 'admin'}
                                    onChange={() => setInviteRole('admin')}
                                />
                                Admin
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-secondary"
                            disabled={inviteLoading}
                            style={{ background: 'var(--bg-color)', border: 'none' }}
                        >
                            {inviteLoading ? <Loader2 className="loading-spinner" style={{ width: '16px', height: '16px' }} /> : 'Enviar Convite'}
                        </button>
                        {inviteSuccess && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success-color)' }}>{inviteSuccess}</p>}
                    </form>
                </div>
            </div>

            {/* Pending Requests List */}
            {pendingUsers.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="title" style={{ marginBottom: '1rem', color: '#F59E0B' }}>Solicitações Pendentes ({pendingUsers.length})</h3>
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {pendingUsers.map(user => (
                            <div key={user.uid} style={{
                                padding: '1rem 1.5rem',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(245, 158, 11, 0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <UserIcon size={20} color="var(--text-secondary)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{user.displayName}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleReject(user.uid)}
                                        className="btn-secondary"
                                        style={{ width: 'auto', padding: '0.5rem 1rem', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                                    >
                                        <XCircle size={18} /> Rejeitar
                                    </button>
                                    <button
                                        onClick={() => handleApprove(user.uid)}
                                        className="btn-primary"
                                        style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--success-color)' }}
                                    >
                                        <CheckCircle size={18} /> Aprovar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Users Permission Matrix */}
            <div>
                <h3 className="title" style={{ marginBottom: '1rem' }}>Gerenciamento de Permissões</h3>
                <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Usuário</th>
                                {MODULES.filter(m => !m.adminOnly).map(module => (
                                    <th key={module.id} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                            <module.icon size={16} />
                                            {module.name}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => {
                                const isAdmin = user.role === 'admin';
                                return (
                                    <tr key={user.uid} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {user.photoUrl ? <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%' }} /> : <UserIcon size={16} />}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: 500 }}>{user.displayName}</span>
                                                        {isAdmin && <span style={{ fontSize: '0.65rem', background: 'rgba(67, 24, 255, 0.1)', color: 'var(--primary-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>DONO</span>}
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.email}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {MODULES.filter(m => !m.adminOnly).map(module => {
                                            const hasAccess = isAdmin || user.allowedModules?.includes(module.id);
                                            return (
                                                <td key={module.id} style={{ textAlign: 'center', padding: '1rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={hasAccess}
                                                        disabled={isAdmin} // Admins always have access
                                                        onChange={(e) => {
                                                            const isChecked = e.target.checked;
                                                            let newAllowed = user.allowedModules || [];
                                                            if (isChecked) {
                                                                newAllowed = [...new Set([...newAllowed, module.id])];
                                                            } else {
                                                                newAllowed = newAllowed.filter((id: string) => id !== module.id);
                                                            }
                                                            // Optimistic update locally
                                                            const updatedUsers = users.map(u => u.uid === user.uid ? { ...u, allowedModules: newAllowed } : u);
                                                            setUsers(updatedUsers);

                                                            // Persist
                                                            updateDoc(doc(db, 'users', user.uid), { allowedModules: newAllowed });
                                                        }}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            cursor: isAdmin ? 'not-allowed' : 'pointer',
                                                            accentColor: 'var(--primary-color)'
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}

                                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                                            {!isAdmin && (
                                                <button className="btn-secondary" style={{ width: '32px', height: '32px', padding: 0, border: 'none', margin: '0 auto' }}>
                                                    <MoreVertical size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersModule;
