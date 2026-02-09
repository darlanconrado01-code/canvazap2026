import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { BudgetProposal } from './BudgetModule';
import { Check, X, Printer, Download, MessageCircle, AlertTriangle, Loader2 } from 'lucide-react';

const PublicProposal = () => {
    const { id } = useParams();
    const [proposal, setProposal] = useState<BudgetProposal | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!id) return;

        const fetchProposal = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Try Direct Firestore Access (Fastest & Best for Logged Users)
                const docRef = doc(db, 'budget_proposals', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as BudgetProposal;
                    setProposal(data);

                    // Update stats (fire and forget)
                    try {
                        updateDoc(docRef, { viewCount: increment(1), lastViewedAt: serverTimestamp() });
                    } catch (e) { /* ignore read-only */ }

                    setLoading(false);
                    return; // Success!
                }
            } catch (clientError: any) {
                console.warn("Client-side fetch failed (likely permission), trying API fallback...", clientError);
            }

            // 2. Fallback to Server API (For Public Access / Permission Denied)
            try {
                const response = await fetch(`/api/proposal?id=${id}`);

                if (!response.ok) {
                    let errorMessage = "Erro ao carregar orçamento.";
                    try {
                        const errorText = await response.text();
                        try {
                            const errorJson = JSON.parse(errorText);
                            errorMessage = errorJson.error || errorJson.message || errorMessage;
                        } catch (jsonError) {
                            // If not JSON, use the raw text if it's not too long (e.g. HTML error page)
                            if (errorText && errorText.length < 200) errorMessage = errorText;
                            else errorMessage = `Erro ${response.status}: Falha no servidor.`;
                        }
                    } catch (e) {
                        console.error("Failed to read error response", e);
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();

                // Patch dates from ISO strings to objects if needed by UI
                // The UI uses data.createdAt.toDate() usually. 
                // We create a helper proxy or simple object for compatibility.
                const patchedData: any = { ...data };
                if (data.createdAt && typeof data.createdAt === 'string') patchedData.createdAt = { toDate: () => new Date(data.createdAt) };
                if (data.expiresAt && typeof data.expiresAt === 'string') patchedData.expiresAt = { toDate: () => new Date(data.expiresAt) };
                if (data.lastViewedAt && typeof data.lastViewedAt === 'string') patchedData.lastViewedAt = { toDate: () => new Date(data.lastViewedAt) };

                setProposal(patchedData as BudgetProposal);
            } catch (apiError: any) {
                console.error("API fallback also failed:", apiError);
                // Only show error if BOTH failed
                setError(apiError.message || "Não foi possível carregar o orçamento.");
            } finally {
                setLoading(false);
            }
        };

        fetchProposal();
    }, [id]);

    // Helper to parse message (duplicated to avoid circular deps with BudgetModule if any)
    const parseMessage = (template: string, data: any) => {
        if (!template) return '';
        let msg = template;
        msg = msg.replace(/{{nome}}/g, data.clientName || '');
        msg = msg.replace(/{{telefone}}/g, data.clientPhone || '');
        msg = msg.replace(/{{valor}}/g, data.totalAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '');
        msg = msg.replace(/{{link}}/g, data.proposalLink || '');

        if (msg.includes('{{itens}}')) {
            const itemsList = data.items?.map((i: any) => `- ${i.quantity}x ${i.serviceName} (${i.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`).join('\n') || '';
            msg = msg.replace(/{{itens}}/g, itemsList);
        }

        return msg;
    };

    const handleStatusUpdate = async (newStatus: 'approved' | 'rejected') => {
        if (!proposal || !proposal.id) return;
        if (!confirm(newStatus === 'approved' ? 'Confirma a aprovação deste orçamento?' : 'Deseja realmente recusar este orçamento?')) return;

        setActionLoading(true);
        try {
            // Use API for update
            const response = await fetch(`/api/proposal?id=${proposal.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Falha ao atualizar status');

            setProposal({ ...proposal, status: newStatus });

            // Trigger Webhook if present
            if (proposal.webhookUrl) {
                const proposalLink = `${window.location.origin}/proposta/${proposal.id}`;
                const dataForMessage = { ...proposal, proposalLink }; // Ensure link is available

                // 1. Try from Proposal Snapshot
                let finalMessage = '';
                if (proposal.messageTemplates) {
                    const template = newStatus === 'approved' ? proposal.messageTemplates.approved : proposal.messageTemplates.rejected;
                    if (template) finalMessage = parseMessage(template, dataForMessage);
                }

                // 2. Fallback to Global Settings (Client side fetch might fail here too! But we don't have an API for settings yet.)
                // Given the constraints, let's rely on what we have or try optimistic fetch.
                // For now, if template is missing in proposal (old ones), we might send empty. 
                // But new proposals have it embedded.

                // Generate Items Summary
                const itemsSummary = proposal.items.map(i => `${i.quantity}x ${i.serviceName} (${i.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`).join('\n');

                fetch(proposal.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: newStatus === 'approved' ? 'proposal_approved' : 'proposal_rejected',
                        message: finalMessage,
                        proposalId: proposal.id,
                        clientName: proposal.clientName,
                        clientPhone: proposal.clientPhone,
                        totalAmount: proposal.totalAmount,
                        status: newStatus,
                        items: proposal.items,
                        itemsSummary: itemsSummary
                    })
                }).catch(err => console.error("Webhook trigger failed", err));
            }

        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar status. Tente novamente.');
        }
        setActionLoading(false);
    };

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
            <Loader2 className="loading-spinner" style={{ width: '40px', height: '40px' }} />
        </div>
    );

    if (!proposal) return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '2rem', textAlign: 'center' }}>
            <AlertTriangle size={48} color={error?.includes('Acesso') ? "#ef4444" : "var(--text-secondary)"} />
            <h2 style={{ marginTop: '1rem', color: 'var(--text-color)' }}>{error || "Orçamento não encontrado"}</h2>
            {error?.includes('Acesso') && (
                <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', maxWidth: '500px' }}>
                    Se você é o administrador, verifique se o "Login Anônimo" está ativado no Firebase Console ou se as regras de segurança permitem leitura pública.
                </p>
            )}
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ width: '60px', height: '60px', background: 'var(--primary-color)', borderRadius: '16px', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b' }}>Proposta Comercial</h1>
                    <p style={{ color: '#64748b' }}>Preparado especialmente para {proposal.clientName}</p>
                </div>

                {/* Status Banner */}
                {proposal.status !== 'pending' && (
                    <div style={{
                        background: proposal.status === 'approved' ? '#dcfce7' : '#fee2e2',
                        color: proposal.status === 'approved' ? '#166534' : '#991b1b',
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 700
                    }}>
                        {proposal.status === 'approved' ? <Check size={20} /> : <X size={20} />}
                        Orçamento {proposal.status === 'approved' ? 'Aprovado' : 'Recusado'}
                    </div>
                )}

                {/* Main Card */}
                <div className="glass-card" style={{ background: 'white', padding: '0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Cliente</div>
                                <div style={{ fontWeight: 600 }}>{proposal.clientName}</div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{proposal.clientPhone}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Data</div>
                                <div style={{ fontWeight: 600 }}>
                                    {proposal.createdAt?.toDate ? proposal.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {proposal.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#334155' }}>
                                            {item.serviceName} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>x{item.quantity}</span>
                                        </div>
                                        {item.selectedVariations.length > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                {item.selectedVariations.map(v => `${v.name}`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                        {item.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '2rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b' }}>Total Estimado</span>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                {proposal.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>

                        {/* Expiration Check */}
                        {proposal.expiresAt && proposal.expiresAt.toDate() < new Date() && proposal.status === 'pending' ? (
                            <div style={{ textAlign: 'center', color: '#ef4444', padding: '1rem', background: '#fee2e2', borderRadius: '12px', fontWeight: 700 }}>
                                <AlertTriangle size={24} style={{ display: 'block', margin: '0 auto 8px' }} />
                                Este orçamento expirou em {proposal.expiresAt.toDate().toLocaleDateString()}.
                                <div style={{ fontSize: '0.8rem', fontWeight: 400, marginTop: '4px' }}>Entre em contato conosco para solicitar um novo.</div>
                            </div>
                        ) : (
                            proposal.status === 'pending' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <button
                                        onClick={() => handleStatusUpdate('rejected')}
                                        disabled={actionLoading}
                                        style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                    >
                                        Recusar Oferta
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate('approved')}
                                        disabled={actionLoading}
                                        style={{ padding: '1rem', borderRadius: '12px', background: '#22c55e', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)', transition: 'all 0.2s' }}
                                    >
                                        Aprovar Proposta
                                    </button>
                                </div>
                            )
                        )}

                        {proposal.status === 'approved' && (
                            <div style={{ textAlign: 'center' }}>
                                <button onClick={() => window.print()} className="btn btn-secondary" style={{ width: 'auto', margin: '0 auto' }}>
                                    <Printer size={18} /> Imprimir / Salvar PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    &copy; {new Date().getFullYear()} EcoD3. Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
};

export default PublicProposal;
