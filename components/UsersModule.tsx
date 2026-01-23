
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import {
    Copy,
    Check,
    UserPlus,
    Mail,
    User as UserIcon,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react';
import { MODULES } from './SidebarMenu';

const UsersModule = () => {
    const { userData } = useAuth();
    const [company, setCompany] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
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
        if (!userData?.companyId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch Company Details
            const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
            if (companyDoc.exists()) {
                setCompany(companyDoc.data());
            }

            // Fetch Company Users
            const q = query(collection(db, 'users'), where('companyId', '==', userData.companyId));
            const querySnapshot = await getDocs(q);
            const allUsersData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            setUsers(allUsersData.filter((u: any) => u.status === 'active' || !u.status));
            setPendingUsers(allUsersData.filter((u: any) => u.status === 'pending'));
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (!company?.code) return;
        const link = `${window.location.origin}/join-company?code=${company.code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApprove = async (uid: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            const uData = userSnap.data();

            // Update memberships array
            const newMemberships = (uData.memberships || []).map((m: any) =>
                m.companyId === userData?.companyId ? { ...m, status: 'active' } : m
            );

            await updateDoc(userRef, {
                status: 'active',
                memberships: newMemberships
            });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleReject = async (uid: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            const uData = userSnap.data();

            // Remove from memberships array or set status to rejected?
            // Usually we just remove if rejected during join
            const newMemberships = (uData.memberships || []).filter((m: any) =>
                m.companyId !== userData?.companyId
            );

            await updateDoc(userRef, {
                companyId: null,
                status: null,
                role: null,
                memberships: newMemberships
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
            const q = query(collection(db, 'users'), where('email', '==', inviteEmail));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const targetUser = snapshot.docs[0];
                const targetUserData = targetUser.data();

                if (targetUserData.companyId && targetUserData.companyId !== userData?.companyId) {
                    setInviteSuccess('Usuário já pertence à outra empresa.');
                } else {
                    let memberships = targetUserData.memberships || [];
                    const existingIdx = memberships.findIndex((m: any) => m.companyId === userData?.companyId);
                    const membershipData = {
                        companyId: userData!.companyId,
                        role: inviteRole,
                        status: 'active',
                        companyName: company?.name || 'Empresa',
                        allowedModules: inviteRole === 'admin' ? MODULES.filter(m => !m.superAdminOnly).map(m => m.id) : []
                    };

                    if (existingIdx >= 0) memberships[existingIdx] = membershipData;
                    else memberships.push(membershipData);

                    await updateDoc(doc(db, 'users', targetUser.id), {
                        companyId: userData!.companyId,
                        role: inviteRole,
                        status: 'active',
                        memberships: memberships,
                        allowedModules: membershipData.allowedModules
                    });
                    setInviteSuccess('Usuário adicionado com sucesso!');
                    fetchData();
                }
            } else {
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

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <Loader2 className="loading-spinner" size={48} />
        </div>
    );

    const isCompanyOwner = userData?.uid === company?.ownerId;
    const isRegularAdmin = userData?.role === 'admin';

    return (
        <div className="fade-in">
            {/* Invite Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserPlus size={20} className="text-primary" />
                        Link de Convite
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Convide membros para a <strong>{company?.name}</strong>.
                    </p>
                    <div style={{ background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '8px', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span>{company?.code}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CÓDIGO</span>
                    </div>
                    <button onClick={handleCopyLink} className={copied ? "btn" : "btn btn-primary"} style={{ backgroundColor: copied ? 'var(--success-color)' : '' }}>
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copiado!' : 'Copiar Link'}
                    </button>
                </div>

                <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={20} className="text-primary" />
                        Convidar Direto
                    </h3>
                    <form onSubmit={handleInvite}>
                        <input type="email" className="form-input" placeholder="E-mail" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required style={{ marginBottom: '1rem' }} />
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" checked={inviteRole === 'member'} onChange={() => setInviteRole('member')} /> Membro
                            </label>
                            <label style={{ fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <input type="radio" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} /> Admin
                            </label>
                        </div>
                        <button type="submit" className="btn btn-secondary" disabled={inviteLoading} style={{ background: 'var(--bg-color)', border: 'none' }}>
                            {inviteLoading ? 'Enviando...' : 'Enviar Convite'}
                        </button>
                        {inviteSuccess && <p style={{ marginTop: '0.5rem', color: 'var(--success-color)', fontSize: '0.85rem' }}>{inviteSuccess}</p>}
                    </form>
                </div>
            </div>

            {/* Pending Requests */}
            {pendingUsers.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="title" style={{ marginBottom: '1rem', color: '#F59E0B', fontSize: '1.4rem' }}>Pendentes ({pendingUsers.length})</h3>
                    <div className="glass-card" style={{ padding: 0 }}>
                        {pendingUsers.map(u => (
                            <div key={u.uid} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={20} /></div>
                                    <div><div style={{ fontWeight: 600 }}>{u.displayName}</div><div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.email}</div></div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleReject(u.uid)} className="btn btn-secondary" style={{ width: 'auto', color: 'var(--error-color)' }}><XCircle size={18} /></button>
                                    <button onClick={() => handleApprove(u.uid)} className="btn btn-primary" style={{ width: 'auto', background: 'var(--success-color)' }}><CheckCircle size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Table */}
            <h3 className="title" style={{ marginBottom: '1rem', fontSize: '1.4rem' }}>Membros da Empresa</h3>
            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Usuário</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Papel</th>
                            <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                            {MODULES.filter(m =>
                                m.id !== 'dashboard' &&
                                !m.superAdminOnly &&
                                userData?.companyModules?.includes(m.id)
                            ).map(m => (
                                <th key={m.id} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{m.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => {
                            const isOwner = u.uid === company?.ownerId;
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
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        {isOwner ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                                DONO
                                            </span>
                                        ) : (
                                            <select
                                                disabled={!isCompanyOwner || u.uid === userData?.uid}
                                                value={u.role || 'member'}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value as 'admin' | 'member';
                                                    if (confirm(`Alterar papel de ${u.displayName} para ${newRole}?`)) {
                                                        const userRef = doc(db, 'users', u.uid);
                                                        const memberships = (u.memberships || []).map((ms: any) =>
                                                            ms.companyId === userData?.companyId ? { ...ms, role: newRole } : ms
                                                        );
                                                        await updateDoc(userRef, {
                                                            role: newRole,
                                                            memberships: memberships
                                                        });
                                                        setUsers(prev => prev.map(usr => usr.uid === u.uid ? { ...usr, role: newRole, memberships: memberships } : usr));
                                                    }
                                                }}
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    background: u.role === 'admin' ? 'rgba(67, 24, 255, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                    color: u.role === 'admin' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                                    cursor: (!isCompanyOwner || u.uid === userData?.uid) ? 'default' : 'pointer'
                                                }}
                                            >
                                                <option value="member">MEMBRO</option>
                                                <option value="admin">ADMIN</option>
                                            </select>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '1rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: (u.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)'), color: (u.status === 'pending' ? '#F59E0B' : 'var(--success-color)') }}>
                                            {(u.status || 'active').toUpperCase()}
                                        </span>
                                    </td>

                                    {MODULES.filter(m =>
                                        m.id !== 'dashboard' &&
                                        !m.superAdminOnly &&
                                        userData?.companyModules?.includes(m.id)
                                    ).map(m => (
                                        <td key={m.id} style={{ textAlign: 'center', padding: '1rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={isOwner || u.allowedModules?.includes(m.id)}
                                                disabled={isOwner || !isCompanyOwner || u.uid === userData?.uid}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    let allowed = u.allowedModules || [];
                                                    if (checked) allowed = [...new Set([...allowed, m.id])];
                                                    else allowed = allowed.filter((id: string) => id !== m.id);

                                                    const newMemberships = (u.memberships || []).map((ms: any) => ms.companyId === userData?.companyId ? { ...ms, allowedModules: allowed } : ms);
                                                    updateDoc(doc(db, 'users', u.uid), {
                                                        allowedModules: allowed,
                                                        memberships: newMemberships
                                                    });
                                                    setUsers(prev => prev.map(usr => usr.uid === u.uid ? { ...usr, allowedModules: allowed, memberships: newMemberships } : usr));
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersModule;
