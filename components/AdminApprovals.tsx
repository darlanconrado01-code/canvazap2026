
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import {
    User as UserIcon,
    CheckCircle,
    XCircle,
    Loader2,
    Building2,
    Clock,
    RefreshCw
} from 'lucide-react';

const AdminApprovals = () => {
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const [companies, setCompanies] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const fetchPendingUsers = async () => {
        setLoading(true);
        try {
            // Method 1: Check root 'pending' status
            const q1 = query(collection(db, 'users'), where('status', '==', 'pending'));
            const snap1 = await getDocs(q1);
            let pending = snap1.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            // Method 2: Fallback - Scan for users with pending memberships if list is small
            // or if we suspect some are missing root status
            if (pending.length === 0) {
                const allUsersSnap = await getDocs(collection(db, 'users'));
                const allUsers = allUsersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                pending = allUsers.filter((u: any) =>
                    u.status === 'pending' ||
                    (u.memberships && u.memberships.some((m: any) => m.status === 'pending'))
                );
            }

            // Deduplicate (just in case)
            const uniquePending = Array.from(new Map(pending.map(u => [u.uid, u])).values());

            // Collect unique company IDs to fetch names
            const companyIds = new Set<string>();
            uniquePending.forEach((u: any) => {
                if (u.companyId) companyIds.add(u.companyId);
                if (u.memberships) {
                    u.memberships.forEach((m: any) => {
                        if (m.status === 'pending') companyIds.add(m.companyId);
                    });
                }
            });

            const companyMap: { [key: string]: string } = {};
            for (const id of Array.from(companyIds)) {
                const cDoc = await getDoc(doc(db, 'companies', id));
                if (cDoc.exists()) {
                    companyMap[id] = cDoc.data().name;
                }
            }

            setCompanies(companyMap);
            setPendingUsers(uniquePending);
        } catch (e: any) {
            console.error("FIRESTORE ERROR (AdminApprovals)", {
                code: e?.code,
                message: e?.message,
                adminUid: auth.currentUser?.uid
            });
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⌛❌</div>
                <h3>Erro ao carregar aprovações</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{error.code}: {error.message}</p>
                <button onClick={() => fetchPendingUsers()} className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>Tentar Novamente</button>
            </div>
        );
    }

    const handleApprove = async (uid: string, targetCompanyId: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            const uData = userSnap.data();

            // Update memberships array
            const newMemberships = (uData.memberships || []).map((m: any) =>
                m.companyId === targetCompanyId ? { ...m, status: 'active' } : m
            );

            await updateDoc(userRef, {
                status: 'active',
                companyId: targetCompanyId,
                currentCompanyId: targetCompanyId,
                memberships: newMemberships
            });

            // Update company member list for rules compatibility
            try {
                await updateDoc(doc(db, 'companies', targetCompanyId), {
                    memberUids: arrayUnion(uid)
                });
            } catch (e) {
                console.warn('Could not update company memberUids:', e);
            }

            setPendingUsers(prev => prev.filter(u => u.uid !== uid));
            alert('Usuário aprovado com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao aprovar usuário.');
        }
    };

    const handleReject = async (uid: string, targetCompanyId: string) => {
        if (!confirm('Tem certeza que deseja rejeitar esta solicitação?')) return;

        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            const uData = userSnap.data();

            // Remove from memberships array
            const newMemberships = (uData.memberships || []).filter((m: any) =>
                m.companyId !== targetCompanyId
            );

            await updateDoc(userRef, {
                companyId: uData.companyId === targetCompanyId ? null : uData.companyId,
                status: uData.companyId === targetCompanyId ? null : uData.status,
                memberships: newMemberships
            });

            setPendingUsers(prev => prev.filter(u => u.uid !== uid));
            alert('Solicitação rejeitada.');
        } catch (error) {
            console.error(error);
            alert('Erro ao rejeitar solicitação.');
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <Loader2 className="loading-spinner" size={48} />
        </div>
    );

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem' }}>Aprovações Globais ⏳</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Autorize a entrada de usuários nas empresas do sistema.</p>
                </div>
                <button onClick={fetchPendingUsers} className="btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <RefreshCw size={18} /> Atualizar
                </button>
            </div>

            {pendingUsers.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Clock size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--text-secondary)' }}>Nenhuma solicitação pendente no momento.</h3>
                </div>
            ) : (
                <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Usuário</th>
                                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Empresa Solicitada</th>
                                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>E-mail</th>
                                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingUsers.map(u => {
                                // Find which company is actually pending for this user
                                const pendingMembership = u.memberships?.find((m: any) => m.status === 'pending');
                                const targetId = pendingMembership?.companyId || u.companyId;
                                const targetName = pendingMembership?.companyName || companies[targetId] || 'Empresa desconhecida';

                                return (
                                    <tr key={u.uid} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {u.photoUrl ? <img src={u.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <UserIcon size={20} />}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{u.displayName || 'Sem Nome'}</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Building2 size={16} className="text-primary" />
                                                <span style={{ fontWeight: 500 }}>{targetName}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                                            {u.email}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleReject(u.uid, targetId)}
                                                    className="btn btn-secondary"
                                                    style={{ width: 'auto', padding: '0.5rem 1rem', color: 'var(--error-color)' }}
                                                >
                                                    <XCircle size={18} style={{ marginRight: '0.5rem' }} />
                                                    Rejeitar
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(u.uid, targetId)}
                                                    className="btn btn-primary"
                                                    style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--success-color)' }}
                                                >
                                                    <CheckCircle size={18} style={{ marginRight: '0.5rem' }} />
                                                    Aprovar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminApprovals;
