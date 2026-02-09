
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Search,
    DollarSign,
    Calendar,
    Clock,
    FileText,
    Copy,
    ExternalLink,
    ChevronRight,
    Loader2,
    Eye,
    Settings
} from 'lucide-react';
import { getDoc } from 'firebase/firestore';

// --- Types ---
// --- Types ---
export interface ServiceVariation {
    id: string;
    name: string; // e.g., "Entrega Expressa (24h)"
    priceChange: number; // e.g., 50 (adds 50) or -10 (subtracts 10)
    type: 'additive' | 'override'; // 'additive' (Add/Sub) or 'override' (Replace Base Price)
}

export interface BudgetService {
    id?: string;
    name: string;
    description: string;
    basePrice: number;
    variations: ServiceVariation[];
    active: boolean;
}

export interface ProposalItem {
    serviceId: string;
    serviceName: string;
    basePrice: number;
    selectedVariations: ServiceVariation[]; // Variations applied
    finalPrice: number;
    quantity: number;
}

export interface BudgetProposal {
    id?: string;
    clientName: string;
    clientPhone: string;
    items: ProposalItem[];
    totalAmount: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    expiresAt?: any;
    viewCount?: number;
    lastViewedAt?: any;
    notes?: string;
    webhookUrl?: string; // Legacy support or just URL
    messageTemplates?: {
        created: string;
        approved: string;
        rejected: string;
    };
}

export const parseMessage = (template: string, data: any) => {
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

const ServiceForm = ({ initialData, onSave, onCancel }: { initialData?: BudgetService, onSave: (data: BudgetService) => void, onCancel: () => void }) => {
    const [data, setData] = useState<BudgetService>(initialData || { name: '', description: '', basePrice: 0, variations: [], active: true });

    const addVariation = () => {
        setData({
            ...data,
            variations: [...data.variations, { id: Date.now().toString(), name: '', priceChange: 0, type: 'additive' }]
        });
    };

    const updateVariation = (idx: number, field: keyof ServiceVariation, value: any) => {
        const newVars = [...data.variations];
        newVars[idx] = { ...newVars[idx], [field]: value };
        setData({ ...data, variations: newVars });
    };

    const removeVariation = (idx: number) => {
        setData({ ...data, variations: data.variations.filter((_, i) => i !== idx) });
    };

    return (
        <div className="glass-card">
            <h3 className="title" style={{ marginBottom: '1.5rem' }}>{initialData ? 'Editar Serviço' : 'Novo Serviço'}</h3>

            <div className="responsive-grid">
                <div className="form-group">
                    <label className="form-label">Nome do Serviço</label>
                    <input className="form-input" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Preço Base (R$)</label>
                    <input type="number" className="form-input" value={data.basePrice} onChange={e => setData({ ...data, basePrice: parseFloat(e.target.value) || 0 })} />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} />
            </div>

            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Variações / Adicionais
                    <button type="button" onClick={addVariation} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>+ Adicionar Variação</button>
                </label>

                {data.variations.map((v, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <input className="form-input" placeholder="Nome (ex: Entrega Rápida)" value={v.name} onChange={e => updateVariation(idx, 'name', e.target.value)} style={{ flex: 2 }} />
                        <select className="form-input" value={v.type} onChange={e => updateVariation(idx, 'type', e.target.value)} style={{ flex: 1 }}>
                            <option value="additive">Adicionar (+)</option>
                            <option value="override">Substituir (=)</option>
                        </select>
                        <input type="number" className="form-input" placeholder="Valor" value={v.priceChange} onChange={e => updateVariation(idx, 'priceChange', parseFloat(e.target.value) || 0)} style={{ flex: 1 }} />
                        <button onClick={() => removeVariation(idx)} style={{ color: 'red', background: 'none', border: 'none' }}><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancelar</button>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => onSave(data)}>Salvar Serviço</button>
            </div>
        </div>
    );
};

const ServicesManager = () => {
    const [services, setServices] = useState<BudgetService[]>([]);
    const [editing, setEditing] = useState<BudgetService | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'budget_services'), orderBy('name'));
        return onSnapshot(q, snap => {
            setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetService)));
        });
    }, []);

    const handleSave = async (service: BudgetService) => {
        try {
            if (service.id) {
                // remove id from data before update to avoid recursion if strictly typed or firestore warns
                const { id, ...rest } = service;
                await updateDoc(doc(db, 'budget_services', service.id), rest);
            } else {
                await addDoc(collection(db, 'budget_services'), { ...service, active: true });
            }
            setIsFormOpen(false);
            setEditing(null);
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar serviço: ' + e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Isso não afetará orçamentos já criados.')) return;
        await deleteDoc(doc(db, 'budget_services', id));
    };

    if (isFormOpen) return <ServiceForm initialData={editing || undefined} onSave={handleSave} onCancel={() => { setIsFormOpen(false); setEditing(null); }} />;

    return (
        <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="title">Meus Serviços</h3>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => { setEditing(null); setIsFormOpen(true); }}>
                    <Plus size={18} /> Novo
                </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
                {services.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'white' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.description || 'Sem descrição'}</div>
                            <div style={{ fontWeight: 600, color: 'var(--primary-color)', marginTop: '4px' }}>
                                A partir de {s.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            {s.variations?.length > 0 && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#666' }}>{s.variations.length} variações cadastradas</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setEditing(s); setIsFormOpen(true); }} className="btn btn-secondary" style={{ padding: '8px', width: 'auto' }}><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(s.id!)} className="btn btn-secondary" style={{ padding: '8px', width: 'auto', color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
                {services.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Nenhum serviço cadastrado.</div>}
            </div>
        </div>
    );
};

// 2. Proposal Builder
const ProposalBuilder = ({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) => {
    const [step, setStep] = useState(1);
    const [clientData, setClientData] = useState({ name: '', phone: '', notes: '', validityDays: 15 });
    const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
    const [availableServices, setAvailableServices] = useState<BudgetService[]>([]);
    const [loading, setLoading] = useState(false);

    // Need to import getDocs locally or move inside useEffect
    // Re-implementing with onSnapshot for simplicity in dependency
    useEffect(() => {
        const q = query(collection(db, 'budget_services'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAvailableServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetService)));
        });
        return () => unsubscribe();
    }, []);


    const addItem = (service: BudgetService) => {
        const newItem: ProposalItem = {
            serviceId: service.id!,
            serviceName: service.name,
            basePrice: service.basePrice,
            selectedVariations: [],
            finalPrice: service.basePrice,
            quantity: 1
        };
        setProposalItems([...proposalItems, newItem]);
    };

    const updateItem = (index: number, changes: Partial<ProposalItem>) => {
        const newItems = [...proposalItems];
        newItems[index] = { ...newItems[index], ...changes };

        // Recalculate price Logic
        const item = newItems[index];

        // 1. Find if there's any 'override' variation. 
        let calculationBase = item.basePrice;
        const overrideVar = item.selectedVariations.filter(v => v.type === 'override').pop();

        if (overrideVar) {
            calculationBase = overrideVar.priceChange;
        }

        let price = calculationBase;

        // 2. Add 'additive' variations
        item.selectedVariations.forEach(v => {
            if (!v.type || v.type === 'additive') {
                price += v.priceChange;
            }
        });

        newItems[index].finalPrice = price * newItems[index].quantity;

        setProposalItems(newItems);
    };

    const toggleVariation = (itemIndex: number, variation: ServiceVariation) => {
        const item = proposalItems[itemIndex];
        const exists = item.selectedVariations.find(v => v.id === variation.id);
        let newVariations;
        if (exists) {
            newVariations = item.selectedVariations.filter(v => v.id !== variation.id);
        } else {
            newVariations = [...item.selectedVariations, variation];
        }
        updateItem(itemIndex, { selectedVariations: newVariations });
    };

    const removeItem = (index: number) => {
        setProposalItems(proposalItems.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return proposalItems.reduce((acc, item) => acc + item.finalPrice, 0);
    };

    const handleCreateProposal = async () => {
        if (!clientData.name) return alert('Nome do cliente é obrigatório');
        if (proposalItems.length === 0) return alert('Adicione pelo menos um serviço');

        setLoading(true);
        try {
            // Get Webhook URL & Templates first
            let settingsData: any = {};
            try {
                const settingsSnap = await getDoc(doc(db, 'settings', 'budget_config'));
                if (settingsSnap.exists()) {
                    settingsData = settingsSnap.data();
                }
            } catch (e) {
                console.error("Config fetch error", e);
            }

            // Calculate Expiration
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + (clientData.validityDays || 15));

            const docRef = await addDoc(collection(db, 'budget_proposals'), {
                clientName: clientData.name,
                clientPhone: clientData.phone,
                notes: clientData.notes,
                items: proposalItems,
                totalAmount: calculateTotal(),
                status: 'pending',
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expirationDate),
                viewCount: 0,
                webhookUrl: settingsData.webhookUrl || '',
                messageTemplates: {
                    created: settingsData.createdMessage || 'Olá {{nome}}, segue seu orçamento no valor de {{valor}}:\n\n{{itens}}\n\nAcesse no link: {{link}}',
                    approved: settingsData.approvedMessage || 'Orçamento APROVADO por {{nome}}!\nValor: {{valor}}',
                    rejected: settingsData.rejectedMessage || 'Orçamento recusado por {{nome}}.\nValor: {{valor}}'
                }
            });

            // Trigger Webhook for Creation
            if (settingsData.webhookUrl) {
                const proposalLink = `${window.location.origin}/proposta/${docRef.id}`;
                const itemsSummary = proposalItems.map(i => `${i.quantity}x ${i.serviceName} (${i.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`).join('\n');

                const payloadData = {
                    clientName: clientData.name,
                    clientPhone: clientData.phone,
                    totalAmount: calculateTotal(),
                    proposalLink,
                    items: proposalItems,
                    itemsSummary
                };

                // Use the same default for the immediate message
                const msgTemplate = settingsData.createdMessage || 'Olá {{nome}}, segue seu orçamento no valor de {{valor}}:\n\n{{itens}}\n\nAcesse no link: {{link}}';
                const finalMessage = parseMessage(msgTemplate, payloadData);

                console.log("Sending Webhook:", settingsData.webhookUrl, finalMessage);

                fetch(settingsData.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'proposal_created',
                        message: finalMessage,
                        proposalId: docRef.id,
                        ...payloadData,
                        expiresAt: expirationDate.toISOString()
                    })
                }).catch(err => console.error("Webhook trigger failed", err));
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Erro ao criar orçamento");
        }
        setLoading(false);
    };

    return (
        <div className="glass-card fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onCancel} style={{ background: 'none', border: 'none' }}><X size={24} /></button>
                <h2 className="title">Novo Orçamento</h2>
            </div>

            <div className="responsive-grid">
                {/* Left: Configuration */}
                <div style={{ gridColumn: 'span 2' }}>
                    <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'var(--bg-color)' }}>
                        <h4 className="title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Dados do Cliente</h4>
                        <div className="responsive-grid">
                            <div className="form-group">
                                <label className="form-label">Nome do Cliente / Empresa</label>
                                <input className="form-input" value={clientData.name} onChange={e => setClientData({ ...clientData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">WhatsApp / Telefone</label>
                                <input className="form-input" value={clientData.phone} onChange={e => setClientData({ ...clientData, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="responsive-grid">
                            <div className="form-group">
                                <label className="form-label">Validade (Dias)</label>
                                <input type="number" className="form-input" value={clientData.validityDays} onChange={e => setClientData({ ...clientData, validityDays: parseInt(e.target.value) || 7 })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notas Internas (Opcional)</label>
                            <textarea className="form-input" rows={2} value={clientData.notes} onChange={e => setClientData({ ...clientData, notes: e.target.value })} />
                        </div>
                    </div>

                    <h4 className="title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Serviços Selecionados</h4>
                    {proposalItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                            Nenhum serviço adicionado. Selecione ao lado.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {proposalItems.map((item, idx) => {
                                const originalService = availableServices.find(s => s.id === item.serviceId);
                                return (
                                    <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 700 }}>{item.serviceName}</span>
                                            <button onClick={() => removeItem(idx)} style={{ color: 'var(--error-color)', border: 'none', background: 'none' }}><Trash2 size={16} /></button>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Quantidade</label>
                                                <input type="number" min="1" className="form-input" style={{ padding: '4px 8px' }} value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} />
                                            </div>
                                            <div style={{ flex: 2 }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Adicionais:</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {originalService?.variations.map(v => (
                                                        <button
                                                            key={v.id}
                                                            onClick={() => toggleVariation(idx, v)}
                                                            style={{
                                                                fontSize: '0.7rem',
                                                                padding: '4px 8px',
                                                                borderRadius: '20px',
                                                                border: '1px solid',
                                                                background: item.selectedVariations.find(sv => sv.id === v.id) ? 'var(--primary-light)' : 'transparent',
                                                                borderColor: item.selectedVariations.find(sv => sv.id === v.id) ? 'var(--primary-color)' : 'var(--border-color)',
                                                                color: item.selectedVariations.find(sv => sv.id === v.id) ? 'var(--primary-color)' : 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            {v.name} (+R${v.priceChange})
                                                        </button>
                                                    ))}
                                                    {originalService?.variations.length === 0 && <span style={{ fontSize: '0.7rem', color: '#ccc' }}>N/A</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Item</div>
                                                <div style={{ fontWeight: 800, color: 'var(--primary-color)' }}>
                                                    {item.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Available Services & Summary */}
                <div>
                    <div className="glass-card" style={{ marginBottom: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                        <h4 className="title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Adicionar Serviço</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {availableServices.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => addItem(s)}
                                    className="btn btn-secondary"
                                    style={{ justifyContent: 'space-between', textAlign: 'left', height: 'auto', padding: '10px' }}
                                >
                                    <span style={{ fontSize: '0.85rem' }}>{s.name}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{s.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card" style={{ background: 'var(--primary-color)', color: 'white' }}>
                        <h3 className="title" style={{ color: 'white', marginBottom: '1rem' }}>Resumo</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Itens</span>
                            <span>{proposalItems.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Validade</span>
                            <span>{clientData.validityDays} dias</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>
                            <span>Total</span>
                            <span>{calculateTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <button className="btn" onClick={handleCreateProposal} disabled={loading} style={{ background: 'white', color: 'var(--primary-color)', fontWeight: 800 }}>
                            {loading ? 'Gerando...' : 'Finalizar e Gerar Link'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. Global Settings Sub-Page
const BudgetSettings = ({ onClose }: { onClose: () => void }) => {
    const [config, setConfig] = useState({
        webhookUrl: '',
        createdMessage: 'Olá {{nome}}, segue seu orçamento no valor de {{valor}}:\n\n{{itens}}\n\nAcesse no link: {{link}}',
        approvedMessage: 'Orçamento APROVADO por {{nome}}!\nValor: {{valor}}',
        rejectedMessage: 'Orçamento recusado por {{nome}}.\nValor: {{valor}}'
    });
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'geral' | 'mensagens'>('geral');

    useEffect(() => {
        getDoc(doc(db, 'settings', 'budget_config')).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig({
                    webhookUrl: data.webhookUrl || '',
                    createdMessage: data.createdMessage || config.createdMessage,
                    approvedMessage: data.approvedMessage || config.approvedMessage,
                    rejectedMessage: data.rejectedMessage || config.rejectedMessage
                });
            }
        });
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            await import('firebase/firestore').then(({ setDoc }) =>
                setDoc(doc(db, 'settings', 'budget_config'), config, { merge: true })
            );
            alert('Configurações salvas!');
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar');
        }
        setLoading(false);
    };

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={onClose} className="btn btn-secondary" style={{ width: 'auto' }}>
                    <ChevronRight style={{ transform: 'rotate(180deg)' }} /> Voltar
                </button>
                <h1 className="title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>Configurações de Orçamento</h1>
            </div>

            <div className="glass-card">
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setTab('geral')}
                        style={{ padding: '10px', borderBottom: tab === 'geral' ? '2px solid var(--primary-color)' : 'none', fontWeight: tab === 'geral' ? 700 : 400, background: 'none', cursor: 'pointer' }}
                    >
                        Geral / Webhook
                    </button>
                    <button
                        onClick={() => setTab('mensagens')}
                        style={{ padding: '10px', borderBottom: tab === 'mensagens' ? '2px solid var(--primary-color)' : 'none', fontWeight: tab === 'mensagens' ? 700 : 400, background: 'none', cursor: 'pointer' }}
                    >
                        Mensagens
                    </button>
                </div>

                {tab === 'geral' && (
                    <div className="fade-in">
                        <div className="form-group">
                            <label className="form-label">URL do Webhook (POST)</label>
                            <input
                                className="form-input"
                                value={config.webhookUrl}
                                onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
                                placeholder="https://n8n.seusite.com/webhook/..."
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
                                URL que receberá os dados do orçamento + a mensagem formatada para envio.
                            </p>
                        </div>
                    </div>
                )}

                {tab === 'mensagens' && (
                    <div className="fade-in">
                        <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                            <strong>Variáveis Disponíveis:</strong><br />
                            <code>{'{{nome}}'}</code> - Nome do Cliente<br />
                            <code>{'{{telefone}}'}</code> - Telefone<br />
                            <code>{'{{valor}}'}</code> - Valor Total<br />
                            <code>{'{{link}}'}</code> - Link da Proposta<br />
                            <code>{'{{itens}}'}</code> - Lista de itens (apenas mensagem de criação)
                        </div>

                        <div className="form-group">
                            <label className="form-label">Mensagem: Orçamento Criado</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                value={config.createdMessage}
                                onChange={e => setConfig({ ...config, createdMessage: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Mensagem: Orçamento Aprovado</label>
                            <textarea
                                className="form-input"
                                rows={2}
                                value={config.approvedMessage}
                                onChange={e => setConfig({ ...config, approvedMessage: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Mensagem: Orçamento Recusado</label>
                            <textarea
                                className="form-input"
                                rows={2}
                                value={config.rejectedMessage}
                                onChange={e => setConfig({ ...config, rejectedMessage: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSave} disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 3. Main Dashboard
const BudgetModule = () => {
    const [view, setView] = useState<'list' | 'create' | 'services' | 'settings'>('list');
    const [proposals, setProposals] = useState<BudgetProposal[]>([]);

    // Removed showSettings state in favor of view='settings'

    useEffect(() => {
        const q = query(collection(db, 'budget_proposals'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProposals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetProposal)));
        });
        return () => unsubscribe();
    }, []);

    const copyLink = (id: string) => {
        const url = `${window.location.origin}/proposta/${id}`;
        navigator.clipboard.writeText(url);
        alert('Link copiado: ' + url);
    };

    const handleDeleteProposal = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
        try {
            await deleteDoc(doc(db, 'budget_proposals', id));
        } catch (error) {
            console.error("Error deleting proposal: ", error);
            alert("Erro ao excluir orçamento.");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>Aprovado</span>;
            case 'rejected': return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>Recusado</span>;
            default: return <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>Pendente</span>;
        }
    };

    if (view === 'create') return <ProposalBuilder onCancel={() => setView('list')} onSuccess={() => setView('list')} />;
    if (view === 'services') return (
        <div className="fade-in">
            <button onClick={() => setView('list')} className="btn btn-secondary" style={{ width: 'auto', marginBottom: '1rem' }}>
                <ChevronRight style={{ transform: 'rotate(180deg)' }} /> Voltar
            </button>
            <ServicesManager />
        </div>
    );
    if (view === 'settings') return <BudgetSettings onClose={() => setView('list')} />;

    return (
        <div className="fade-in">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem' }}>Gestão de Orçamentos</h1>
                    <p className="subtitle">Crie propostas personalizadas e envie para seus clientes.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px' }} onClick={() => setView('settings')} title="Configurar Webhook e Mensagens">
                        <Settings size={20} />
                    </button>
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setView('services')}>
                        <DollarSign size={20} /> Serviços
                    </button>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setView('create')}>
                        <Plus size={20} /> Novo Orçamento
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cliente</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Valor Total</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Visualizações</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map(proposal => (
                                <tr key={proposal.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                                        {proposal.createdAt?.toDate ? proposal.createdAt.toDate().toLocaleDateString() : 'Hoje'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600 }}>{proposal.clientName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{proposal.clientPhone}</div>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 700 }}>
                                        {proposal.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => alert(`Visualizações: ${proposal.viewCount || 0}\nÚltimo acesso: ${proposal.lastViewedAt?.toDate ? proposal.lastViewedAt.toDate().toLocaleString() : 'N/A'}`)}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                            title="Clique para ver detalhes de acesso"
                                        >
                                            {getStatusBadge(proposal.status)}
                                        </button>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
                                        {proposal.viewCount || 0}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button onClick={() => copyLink(proposal.id!)} className="btn btn-secondary" style={{ padding: '6px', width: 'auto' }} title="Copiar Link">
                                                <Copy size={16} />
                                            </button>
                                            <a href={`/proposta/${proposal.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px', width: 'auto', display: 'flex' }} title="Ver">
                                                <ExternalLink size={16} />
                                            </a>
                                            <button onClick={() => handleDeleteProposal(proposal.id!)} className="btn btn-secondary" style={{ padding: '6px', width: 'auto', color: '#ef4444' }} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {proposals.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        Nenhum orçamento criado ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BudgetModule;
