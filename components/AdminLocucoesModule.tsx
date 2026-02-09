
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc, limit, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Mic,
    Check,
    X,
    Clock,
    Building2,
    User,
    FileText,
    Filter,
    Search,
    Loader2,
    Calendar,
    MessageSquare,
    Coins,
    Plus,
    XCircle
} from 'lucide-react';

interface AudioRequest {
    id: string;
    text: string;
    charCount: number;
    slotsUsed: number;
    status: 'pending' | 'completed' | 'cancelled';
    createdAt: any;
    companyId: string;
    companyName: string;
    userName: string;
}

const AdminLocucoesModule: React.FC = () => {
    const { userData } = useAuth();
    const [requests, setRequests] = useState<AudioRequest[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('pending');

    // Credit Management State
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [creditsToGrant, setCreditsToGrant] = useState(1);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchCompanies();

        const q = query(
            collection(db, 'audio_requests'),
            limit(200)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AudioRequest));

            // Client-side sort to avoid index requirements
            list.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });

            setRequests(list);
            setLoading(false);
        }, (error) => {
            console.error("Admin query error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const fetchCompanies = async () => {
        try {
            const snap = await getDocs(collection(db, 'companies'));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCompanies(list);
        } catch (e) {
            console.error("Error fetching companies", e);
        }
    };

    const handleUpdateStatus = async (request: AudioRequest, newStatus: 'completed' | 'cancelled') => {
        if (!confirm(`Mudar status para ${newStatus}?`)) return;

        try {
            const requestRef = doc(db, 'audio_requests', request.id);

            if (newStatus === 'cancelled' && request.status !== 'cancelled') {
                const companyRef = doc(db, 'companies', request.companyId);
                await updateDoc(companyRef, {
                    audioCredits: increment(request.slotsUsed)
                });
            }

            await updateDoc(requestRef, {
                status: newStatus,
                updatedAt: new Date(),
                processedBy: userData?.uid
            });

            alert(`Solicitação marcada como ${newStatus}.`);
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar status.");
        }
    };

    const handleGrantCredits = async () => {
        if (!selectedCompanyId) return alert('Selecione uma empresa');
        if (creditsToGrant < 1) return alert('Quantidade inválida');

        setActionLoading(true);
        try {
            const companyRef = doc(db, 'companies', selectedCompanyId);
            await updateDoc(companyRef, {
                audioCredits: increment(creditsToGrant)
            });
            alert('Créditos concedidos com sucesso!');
            setShowCreditModal(false);
            setCreditsToGrant(1);
            fetchCompanies();
        } catch (e) {
            console.error(e);
            alert('Erro ao conceder créditos');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        const matchesSearch =
            req.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.userName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    if (userData?.role !== 'super_admin') return <div className="p-8">Acesso restrito.</div>;

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem' }}>Gestão de Locuções 🎙️</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gerencie solicitações e conceda créditos para as empresas.</p>
                </div>
                <button
                    onClick={() => setShowCreditModal(true)}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '8px', background: '#8B5CF6' }}
                >
                    <Coins size={20} /> Conceder Créditos
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por texto, empresa ou usuário..."
                            className="form-input"
                            style={{ paddingLeft: '2.5rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={18} color="var(--text-secondary)" />
                        <select
                            className="form-input"
                            style={{ width: '180px' }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="all">Todos os Status</option>
                            <option value="pending">Pendentes</option>
                            <option value="completed">Concluídos</option>
                            <option value="cancelled">Cancelados</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 className="loading-spinner" size={40} />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <Mic size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Nenhuma solicitação encontrada.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {filteredRequests.map((req) => (
                        <div key={req.id} className="glass-card fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                    <Building2 size={16} />
                                    {req.companyName?.toUpperCase()}
                                </div>
                                <div style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    background: req.status === 'completed' ? '#f0fdf4' : req.status === 'pending' ? '#fffbeb' : '#fef2f2',
                                    color: req.status === 'completed' ? '#166534' : req.status === 'pending' ? '#92400e' : '#991b1b',
                                }}>
                                    {req.status?.toUpperCase()}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1 }}>
                                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{req.text}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                    <User size={14} /> {req.userName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', justifyContent: 'flex-end' }}>
                                    <Calendar size={14} /> {req.createdAt?.toDate().toLocaleString()}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                                    <FileText size={14} /> {req.charCount} chars • {req.slotsUsed} offs
                                </div>
                            </div>

                            {req.status === 'pending' && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                                    <button
                                        onClick={() => handleUpdateStatus(req, 'cancelled')}
                                        className="btn-secondary"
                                        style={{ flex: 1, color: '#ef4444', borderColor: '#ef4444' }}
                                    >
                                        <X size={18} /> Cancelar/Reembolsar
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus(req, 'completed')}
                                        className="btn btn-primary"
                                        style={{ flex: 1, background: '#22c55e', borderColor: '#22c55e' }}
                                    >
                                        <Check size={18} /> Concluir
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showCreditModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 className="title">Conceder Créditos de Áudio</h3>
                            <button onClick={() => setShowCreditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={24} /></button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Selecionar Empresa</label>
                            <select
                                className="form-input"
                                value={selectedCompanyId}
                                onChange={e => setSelectedCompanyId(e.target.value)}
                            >
                                <option value="">Escolha uma empresa...</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} (Atual: {c.audioCredits || 0})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Quantidade de Offs a Adicionar</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={creditsToGrant}
                                    onChange={e => setCreditsToGrant(Number(e.target.value))}
                                    min="1"
                                />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[5, 10, 20, 50].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setCreditsToGrant(val)}
                                            style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            +{val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreditModal(false)} style={{ flex: 1 }}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleGrantCredits}
                                disabled={actionLoading || !selectedCompanyId}
                                style={{ flex: 1, background: '#8B5CF6' }}
                            >
                                {actionLoading ? <Loader2 className="loading-spinner" /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLocucoesModule;
