
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, arrayUnion, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import {
    User as UserIcon,
    CheckCircle,
    XCircle,
    Loader2,
    Building2,
    Clock,
    RefreshCw,
    Package,
    Users,
    Globe,
    ExternalLink
} from 'lucide-react';

const AdminApprovals = () => {
    const { userData } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [pendingProducts, setPendingProducts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'products'>('users');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const [companies, setCompanies] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (activeTab === 'users') fetchPendingUsers();
        else fetchPendingProducts();
    }, [activeTab]);

    const fetchPendingUsers = async () => {
        setLoading(true);
        try {
            const q1 = query(collection(db, 'users'), where('status', '==', 'pending'));
            const snap1 = await getDocs(q1);
            let pending = snap1.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            if (pending.length === 0) {
                const allUsersSnap = await getDocs(collection(db, 'users'));
                const allUsers = allUsersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                pending = allUsers.filter((u: any) =>
                    u.status === 'pending' ||
                    (u.memberships && u.memberships.some((m: any) => m.status === 'pending'))
                );
            }

            const uniquePending = Array.from(new Map(pending.map(u => [u.uid, u])).values());
            const companyIds = new Set<string>();
            uniquePending.forEach((u: any) => {
                if (u.companyId) companyIds.add(u.companyId);
                if (u.memberships) {
                    u.memberships.forEach((m: any) => {
                        if (m.status === 'pending') companyIds.add(m.companyId);
                    });
                }
            });

            const companyMap: { [key: string]: string } = { ...companies };
            for (const id of Array.from(companyIds)) {
                if (!companyMap[id]) {
                    const cDoc = await getDoc(doc(db, 'companies', id));
                    if (cDoc.exists()) companyMap[id] = cDoc.data().name;
                }
            }

            setCompanies(companyMap);
            setPendingUsers(uniquePending);
        } catch (e: any) {
            console.error("FIRESTORE ERROR (AdminApprovals)", e);
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingProducts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'products'), where('status', '==', 'pending'), where('isGlobal', '==', false));
            const snap = await getDocs(q);
            const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const companyIds = new Set<string>();
            products.forEach((p: any) => { if (p.companyId) companyIds.add(p.companyId); });

            const companyMap: { [key: string]: string } = { ...companies };
            for (const id of Array.from(companyIds)) {
                if (!companyMap[id]) {
                    const cDoc = await getDoc(doc(db, 'companies', id));
                    if (cDoc.exists()) companyMap[id] = cDoc.data().name;
                }
            }
            setCompanies(companyMap);
            setPendingProducts(products);
        } catch (e: any) {
            console.error("Error fetching pending products", e);
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (uid: string, targetCompanyId: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            const uData = userSnap.data();

            const newMemberships = (uData.memberships || []).map((m: any) =>
                m.companyId === targetCompanyId ? { ...m, status: 'active' } : m
            );

            await updateDoc(userRef, {
                status: 'active',
                companyId: targetCompanyId,
                currentCompanyId: targetCompanyId,
                memberships: newMemberships
            });

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

    const handleApproveProduct = async (product: any) => {
        if (!confirm(`Tornar a imagem de "${product.name}" GLOBAL para o EAN ${product.ean}?`)) return;

        try {
            const batch = writeBatch(db);
            const privateRef = doc(db, 'products', product.id);
            const globalRef = doc(db, 'products', product.ean);

            batch.set(globalRef, {
                ...product,
                id: product.ean,
                isGlobal: true,
                status: 'approved',
                approvedAt: new Date(),
                approvedBy: auth.currentUser?.uid,
                originalCompanyId: product.companyId,
                companyId: 'global'
            });

            if (product.id !== product.ean) {
                batch.delete(privateRef);
            }

            await batch.commit();
            setPendingProducts(prev => prev.filter(p => p.id !== product.id));
            alert('Produto aprovado como GLOBAL com sucesso!');
        } catch (e) {
            console.error(e);
            alert('Erro ao aprovar produto.');
        }
    };

    const handleRejectProduct = async (productId: string) => {
        if (!confirm('Rejeitar esta imagem? Ela continuará PRIVADA para a empresa, mas sairá da lista de aprovação.')) return;
        try {
            await updateDoc(doc(db, 'products', productId), {
                status: 'private',
                rejectedAt: new Date(),
                rejectedBy: auth.currentUser?.uid
            });
            setPendingProducts(prev => prev.filter(p => p.id !== productId));
        } catch (e) {
            console.error(e);
            alert('Erro ao rejeitar produto.');
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <Loader2 className="loading-spinner" size={48} />
        </div>
    );

    if (error) {
        return (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⌛❌</div>
                <h3>Erro ao carregar aprovações</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{error.code}: {error.message}</p>
                <button onClick={() => activeTab === 'users' ? fetchPendingUsers() : fetchPendingProducts()} className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}>Tentar Novamente</button>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem' }}>Aprovações Globais ⏳</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Autorize novos usuários ou aprove imagens enviadas pelas empresas.</p>
                </div>
                <button onClick={activeTab === 'users' ? fetchPendingUsers : fetchPendingProducts} className="btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <RefreshCw size={18} /> Atualizar
                </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
                        fontWeight: 600, color: activeTab === 'users' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'users' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Users size={18} /> Usuários ({pendingUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    style={{
                        background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
                        fontWeight: 600, color: activeTab === 'products' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'products' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Package size={18} /> Produtos ({pendingProducts.length})
                </button>
            </div>

            {activeTab === 'users' ? (
                pendingUsers.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <Clock size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--text-secondary)' }}>Nenhuma solicitação de usuário pendente.</h3>
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
                                                    <button onClick={() => handleReject(u.uid, targetId)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', color: 'var(--error-color)' }}>
                                                        <XCircle size={18} style={{ marginRight: '0.5rem' }} /> Rejeitar
                                                    </button>
                                                    <button onClick={() => handleApprove(u.uid, targetId)} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--success-color)' }}>
                                                        <CheckCircle size={18} style={{ marginRight: '0.5rem' }} /> Aprovar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                pendingProducts.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--text-secondary)' }}>Nenhuma imagem de produto pendente para aprovação.</h3>
                    </div>
                ) : (
                    <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', width: '80px' }}>Imagem</th>
                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Produto / EAN</th>
                                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Empresa Origem</th>
                                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingProducts.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ width: 60, height: 60, margin: '0 auto', background: '#f8fafc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.ean}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{companies[p.companyId] || 'Carregando...'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enviado por: {p.uploadedByName}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                                                <button onClick={() => handleRejectProduct(p.id)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem 0.8rem', color: 'var(--error-color)' }}>
                                                    <XCircle size={16} style={{ marginRight: '0.4rem' }} /> Privada
                                                </button>
                                                <button onClick={() => handleApproveProduct(p)} className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.8rem', background: 'var(--primary-color)' }}>
                                                    <Globe size={16} style={{ marginRight: '0.4rem' }} /> Aprovar Global
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
};

export default AdminApprovals;
