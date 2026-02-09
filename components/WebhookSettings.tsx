import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import {
    Webhook,
    Plus,
    Trash2,
    Save,
    ToggleLeft,
    ToggleRight,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { WebhookConfig, WebhookEvent } from '../types';

const WebhookSettings = () => {
    const { userData } = useAuth();
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newWebhook, setNewWebhook] = useState({
        name: '',
        url: '',
        events: [] as WebhookEvent[],
        active: true
    });

    const availableEvents = [
        { id: WebhookEvent.ART_NEW, label: 'Nova arte disponível para aprovação', category: 'APROVAÇÃO DE ARTES' },
        { id: WebhookEvent.ART_APPROVED, label: 'Arte aprovada', category: 'APROVAÇÃO DE ARTES' },
        { id: WebhookEvent.ART_NEW_VERSION, label: 'Nova versão da arte disponível', category: 'APROVAÇÃO DE ARTES' },
        { id: WebhookEvent.ART_REVISION_REQUESTED, label: 'Ajustes solicitados', category: 'APROVAÇÃO DE ARTES' },
        { id: WebhookEvent.TASK_ASSIGNED, label: 'Nova tarefa atribuída', category: 'TAREFAS' },
        { id: WebhookEvent.LAMINA_UPLOAD_REQUEST, label: 'Solicitação de novas imagens (Lâminas)', category: 'LÂMINAS' },
        { id: WebhookEvent.FLYER_ART_GENERATED, label: 'Artes geradas (Encartes)', category: 'ENCARTES' },
        { id: WebhookEvent.WHATSAPP_BLAST, label: 'Disparo WhatsApp (PetVille)', category: 'DISPAROS' },
    ];

    useEffect(() => {
        if (!userData?.companyId) return;

        const q = query(collection(db, 'companies', userData.companyId, 'webhooks'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const hooks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WebhookConfig[];
            setWebhooks(hooks);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.companyId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData?.companyId) return;

        try {
            await addDoc(collection(db, 'companies', userData.companyId, 'webhooks'), {
                ...newWebhook,
                createdAt: new Date().toISOString()
            });
            setShowAddForm(false);
            setNewWebhook({ name: '', url: '', events: [], active: true });
        } catch (error) {
            console.error("Error creating webhook:", error);
            alert('Erro ao criar webhook.');
        }
    };

    const handleToggleEvent = (hookId: string, eventId: WebhookEvent) => {
        const hook = webhooks.find(h => h.id === hookId);
        if (!hook || !userData?.companyId) return;

        const newEvents = hook.events.includes(eventId)
            ? hook.events.filter(e => e !== eventId)
            : [...hook.events, eventId];

        updateDoc(doc(db, 'companies', userData.companyId, 'webhooks', hookId), {
            events: newEvents
        });
    };

    const handleToggleActive = (hookId: string, currentActive: boolean) => {
        if (!userData?.companyId) return;
        updateDoc(doc(db, 'companies', userData.companyId, 'webhooks', hookId), {
            active: !currentActive
        });
    };

    const handleDelete = async (hookId: string) => {
        if (!userData?.companyId || !confirm('Tem certeza que deseja excluir este webhook?')) return;
        try {
            await deleteDoc(doc(db, 'companies', userData.companyId, 'webhooks', hookId));
        } catch (error) {
            console.error("Error deleting webhook:", error);
        }
    };

    if (loading) return <div className="p-8">Carregando webhooks...</div>;

    return (
        <div className="fade-in" style={{ padding: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h3 className="title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Webhook size={24} className="text-primary" /> Webhooks
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Configure endereços para receber notificações em tempo real do sistema.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Plus size={18} /> Novo Webhook
                </button>
            </div>

            {showAddForm && (
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--primary-color)' }}>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label className="form-label mb-1 block">Nome do Webhook</label>
                                <input
                                    type="text"
                                    className="form-input w-full"
                                    placeholder="Ex: Integração n8n ou Zapier"
                                    value={newWebhook.name}
                                    onChange={e => setNewWebhook({ ...newWebhook, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label mb-1 block">URL do Endpoint</label>
                                <input
                                    type="url"
                                    className="form-input w-full"
                                    placeholder="https://..."
                                    value={newWebhook.url}
                                    onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label mb-2 block">Eventos para disparar</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                {availableEvents.map(event => (
                                    <label key={event.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="checkbox"
                                            checked={newWebhook.events.includes(event.id)}
                                            onChange={() => {
                                                const events = newWebhook.events.includes(event.id)
                                                    ? newWebhook.events.filter(e => e !== event.id)
                                                    : [...newWebhook.events, event.id];
                                                setNewWebhook({ ...newWebhook, events });
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{event.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">Cancelar</button>
                            <button type="submit" className="btn btn-primary">Criar Webhook</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {webhooks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                        <AlertCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Nenhum webhook configurado ainda.</p>
                    </div>
                ) : (
                    webhooks.map(hook => (
                        <div key={hook.id} className="glass-card" style={{ padding: '1.5rem', opacity: hook.active ? 1 : 0.7 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                        <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{hook.name}</h4>
                                        {hook.active ? (
                                            <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '0.1rem 0.5rem', borderRadius: '100px', fontWeight: 600 }}>ATIVO</span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '0.1rem 0.5rem', borderRadius: '100px', fontWeight: 600 }}>INATIVO</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <ExternalLink size={14} />
                                        <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{hook.url}</code>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleToggleActive(hook.id, hook.active)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title={hook.active ? "Desativar" : "Ativar"}
                                    >
                                        {hook.active ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-gray-400" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(hook.id)}
                                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <h5 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Eventos Ativos</h5>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                    {availableEvents.map(event => (
                                        <div
                                            key={event.id}
                                            onClick={() => handleToggleEvent(hook.id, event.id as WebhookEvent)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.6rem 0.75rem',
                                                borderRadius: '8px',
                                                background: hook.events.includes(event.id as WebhookEvent) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                                                border: '1px solid',
                                                borderColor: hook.events.includes(event.id as WebhookEvent) ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {hook.events.includes(event.id as WebhookEvent) ? (
                                                <CheckCircle2 size={16} className="text-primary" />
                                            ) : (
                                                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}></div>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{event.label}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{event.category}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WebhookSettings;
