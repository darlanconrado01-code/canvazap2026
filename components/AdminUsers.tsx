
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, arrayUnion, query, where, writeBatch } from 'firebase/firestore';
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
    Eye,
    Trash2,
    RotateCcw,
    ChevronDown
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

    // Substitute User State
    const [showSubstituteModal, setShowSubstituteModal] = useState(false);
    const [substituteFromUser, setSubstituteFromUser] = useState<any>(null);
    const [substituteToUserId, setSubstituteToUserId] = useState('');
    const [openCompanyDropdown, setOpenCompanyDropdown] = useState<string | null>(null);

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

    const handleRemoveFromCompany = async (user: any, companyId: string) => {
        if (!confirm(`Tem certeza que deseja remover este usuário da empresa?`)) return;

        setActionLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const newMemberships = (user.memberships || []).filter((m: any) => m.companyId !== companyId);

            const updateData: any = {
                memberships: newMemberships
            };

            // If primary company is the one being removed, pick another or set to null
            if (user.companyId === companyId) {
                if (newMemberships.length > 0) {
                    updateData.companyId = newMemberships[0].companyId;
                    updateData.currentCompanyId = newMemberships[0].companyId;
                    updateData.role = newMemberships[0].role || 'member';
                } else {
                    updateData.companyId = null;
                    updateData.currentCompanyId = null;
                    updateData.role = 'membro';
                }
            }

            await updateDoc(userRef, updateData);

            // Update company member list
            try {
                const companyDoc = allCompanies.find(c => c.id === companyId);
                if (companyDoc && companyDoc.memberUids) {
                    await updateDoc(doc(db, 'companies', companyId), {
                        memberUids: companyDoc.memberUids.filter((id: string) => id !== user.uid)
                    });
                }
            } catch (e) {
                console.warn("Could not update company member list:", e);
            }

            alert('Vínculo removido com sucesso.');
            fetchData();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao remover: ' + error.message);
        } finally {
            setActionLoading(false);
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



    const handleSubstituteUser = async () => {
        if (!substituteFromUser || !substituteToUserId) return alert("Selecione os usuários de origem e destino.");
        if (substituteFromUser.uid === substituteToUserId) return alert("Os usuários devem ser diferentes.");

        if (!confirm(`Tem certeza que deseja transferir TODAS as responsabilidades de ${substituteFromUser.displayName} para o novo usuário?`)) return;

        setActionLoading(true);
        try {
            const batch = writeBatch(db);
            const fromId = substituteFromUser.uid;
            const toId = substituteToUserId;
            const toUser = users.find(u => u.uid === toId);
            const toName = toUser?.displayName || 'Usuário Substituto';

            // 1. Product Requests (Requester / ResolvedBy)
            // Query is expensive for batch, so we might need to do multiple batches or individual updates. 
            // For safety and simpler implementation in this context, we will use individual updates or smaller batches.
            // However, Firestore limits batch to 500 ops.

            // Let's do it collection by collection.

            // A. Product Requests (requester.userId inside array? No, looking at structure it seems plain fields usually)
            // checking product_requests structure... it has 'userId' field.
            const reqQuery = query(collection(db, 'product_requests'), where('userId', '==', fromId));
            const reqSnap = await getDocs(reqQuery);
            reqSnap.forEach(doc => {
                updateDoc(doc.ref, { userId: toId, userName: toName });
            });

            // B. Art Approvals - Creator
            const artCreatorQuery = query(collection(db, 'art_approvals'), where('creatorId', '==', fromId));
            const artCreatorSnap = await getDocs(artCreatorQuery);
            artCreatorSnap.forEach(doc => {
                updateDoc(doc.ref, { creatorId: toId });
            });

            // C. Art Approvals - CreatedBy
            const artCreatedByQuery = query(collection(db, 'art_approvals'), where('createdBy', '==', fromId));
            const artCreatedBySnap = await getDocs(artCreatedByQuery);
            artCreatedBySnap.forEach(doc => {
                updateDoc(doc.ref, { createdBy: toId });
            });

            // D. Art Approvals - Approvers (Array)
            // We need to find docs where approverIds array-contains fromId
            const artApproverQuery = query(collection(db, 'art_approvals'), where('approverIds', 'array-contains', fromId));
            const artApproverSnap = await getDocs(artApproverQuery);
            artApproverSnap.forEach(doc => {
                const data = doc.data();
                const newApprovers = (data.approverIds || []).filter((id: string) => id !== fromId);
                if (!newApprovers.includes(toId)) newApprovers.push(toId);
                updateDoc(doc.ref, { approverIds: newApprovers });
            });

            alert(`Substituição concluída! Atividades transferidas de ${substituteFromUser.displayName} para ${toName}.`);
            setShowSubstituteModal(false);
            setSubstituteFromUser(null);
            setSubstituteToUserId('');

        } catch (error: any) {
            console.error("Erro na substituição:", error);
            alert("Erro ao substituir: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fade-in">
            {/* Substitute Modal */}
            {showSubstituteModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }}>
                    <div className="glass-card fade-in" style={{ maxWidth: '500px', width: '100%', position: 'relative' }}>
                        <button
                            onClick={() => setShowSubstituteModal(false)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                        <h2 className="title" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Substituição de Usuário 🔄</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Transfira responsabilidades (criação de artes, aprovações, solicitações) de um usuário para outro. Útil para férias ou desligamentos.
                        </p>

                        <div className="form-group">
                            <label className="form-label">De (Usuário Original)</label>
                            <input className="form-input" value={substituteFromUser?.displayName || ''} disabled style={{ background: '#f1f5f9' }} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Para (Novo Responsável)</label>
                            <select className="form-input" value={substituteToUserId} onChange={e => setSubstituteToUserId(e.target.value)}>
                                <option value="">Selecione o substituto...</option>
                                {users.filter(u => u.uid !== substituteFromUser?.uid && u.companyId === substituteFromUser?.companyId).map(u => (
                                    <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>
                                ))}
                            </select>
                        </div>

                        <button className="btn btn-primary" onClick={handleSubstituteUser} disabled={actionLoading || !substituteToUserId}>
                            {actionLoading ? 'Processando...' : 'Confirmar Transferência'}
                        </button>
                    </div>
                </div>
            )}

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 className="title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: '#1e293b' }}>
                    Usuários Totais do Sistema ({filteredUsers.length})
                </h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary"
                    style={{
                        width: 'auto',
                        padding: '0.6rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#4F46E5', // Vibrant Indigo/Blue
                        borderRadius: '8px',
                        border: 'none',
                        color: 'white',
                        fontWeight: 600,
                        boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                    }}
                >
                    <UserPlus size={18} />
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
                                            currentCompanyId: selectedCompanyId,
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

            <div className="glass-card table-responsive" style={{ padding: 0, borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '600px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', height: '50px' }}>
                            <th style={{ textAlign: 'left', padding: '0 1.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', width: '50%' }}>Usuário</th>
                            <th style={{ textAlign: 'center', padding: '0 1rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Empresas</th>
                            <th style={{ textAlign: 'right', padding: '0 1.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((u, index) => {
                            const userCompany = allCompanies.find(c => c.id === u.companyId);
                            const isOwner = userCompany?.ownerId === u.uid;
                            const isSuperAdmin = u.role === 'super_admin';
                            const isAdmin = u.role === 'admin';
                            const companyCount = u.memberships?.length || (userCompany ? 1 : 0);
                            const isDropdownOpen = openCompanyDropdown === u.uid;

                            // Status Indicator Color
                            const statusColor = u.status === 'pending' ? '#f59e0b' : '#22c55e';

                            return (
                                <tr key={u.uid} style={{ borderBottom: index === filteredUsers.length - 1 ? 'none' : '1px solid var(--border-color)', transition: 'background 0.2s', background: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                    <td style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    width: '40px', height: '40px', borderRadius: '50%',
                                                    background: '#e2e8f0', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', color: '#64748b', overflow: 'hidden',
                                                    border: `2px solid ${statusColor}`
                                                }}>
                                                    {u.photoUrl ? (
                                                        <img src={u.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <UserIcon size={20} />
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{u.displayName || 'Sem Nome'}</span>
                                                    {isSuperAdmin && <span title="Super Admin" style={{ fontSize: '0.65rem', background: '#0f172a', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>MASTER</span>}
                                                    {!isSuperAdmin && isOwner && <span title="Dono" style={{ fontSize: '0.65rem', background: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>DONO</span>}
                                                    {!isSuperAdmin && !isOwner && isAdmin && <span title="Admin" style={{ fontSize: '0.65rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>ADMIN</span>}
                                                </div>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td style={{ textAlign: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                                        <button
                                            onClick={() => setOpenCompanyDropdown(isDropdownOpen ? null : u.uid)}
                                            style={{
                                                background: isDropdownOpen ? '#e2e8f0' : 'transparent',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '20px',
                                                padding: '6px 16px',
                                                fontSize: '0.8rem',
                                                color: '#475569',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontWeight: 600,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Building2 size={14} />
                                            {companyCount === 0 ? 'Nenhuma' : `${companyCount} Empresa${companyCount > 1 ? 's' : ''}`}
                                            <div style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                <ChevronDown size={12} />
                                            </div>
                                        </button>

                                        {isDropdownOpen && (
                                            <div className="glass-card section-fade-in" style={{
                                                position: 'absolute',
                                                top: '80%',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                zIndex: 100,
                                                background: 'white',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                                border: '1px solid #e2e8f0',
                                                width: 'max-content',
                                                minWidth: '220px',
                                                maxWidth: '300px',
                                                padding: '0.5rem',
                                                textAlign: 'left'
                                            }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', padding: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    Vínculos de Empresa
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                                                    {u.memberships && u.memberships.length > 0 ? (
                                                        u.memberships.map((m: any) => (
                                                            <div key={m.companyId} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                background: '#f8fafc',
                                                                fontSize: '0.85rem'
                                                            }}>
                                                                <span style={{ fontWeight: 500, color: '#334155' }}>
                                                                    {m.companyName || allCompanies.find(c => c.id === m.companyId)?.name || 'Empresa...'}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveFromCompany(u, m.companyId);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex', opacity: 0.6 }}
                                                                    title="Remover acesso"
                                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        userCompany ? (
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                background: '#f8fafc',
                                                                fontSize: '0.85rem'
                                                            }}>
                                                                <span style={{ fontWeight: 500, color: '#334155' }}>
                                                                    {userCompany.name}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveFromCompany(u, u.companyId);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex', opacity: 0.6 }}
                                                                    title="Remover acesso"
                                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ padding: '10px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center' }}>
                                                                Sem vínculos ativos.
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>

                                    <td style={{ textAlign: 'right', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                                            <button
                                                title="Visualizar como este usuário"
                                                onClick={() => impersonateUser(u.uid)}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <Eye size={18} />
                                            </button>

                                            <button
                                                title="Redefinir Senha"
                                                onClick={() => {
                                                    setResetUser(u);
                                                    setShowResetModal(true);
                                                }}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <Key size={18} />
                                            </button>

                                            <button
                                                title="Adicionar à Empresa"
                                                onClick={() => {
                                                    setTargetUser(u);
                                                    setSelectedCompanyId(u.companyId || '');
                                                    setShowAddToCompanyModal(true);
                                                }}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--success-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <UserPlus size={18} />
                                            </button>

                                            <button
                                                title="Tornar Super Admin"
                                                onClick={async () => {
                                                    if (confirm('Deseja dar poderes de Super Admin a este usuário?')) {
                                                        await updateDoc(doc(db, 'users', u.uid), { isSystemAdmin: true });
                                                        fetchData();
                                                    }
                                                }}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#eab308'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <Shield size={18} />
                                            </button>

                                            <button
                                                title="Substituir Usuário"
                                                onClick={() => { setSubstituteFromUser(u); setShowSubstituteModal(true); }}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#8b5cf6'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <RotateCcw size={18} />
                                            </button>

                                            <button
                                                title="Excluir Usuário"
                                                onClick={async () => {
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
                                                }}
                                                className="action-btn"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default AdminUsers;
