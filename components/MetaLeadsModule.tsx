
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Users,
    Send,
    Trash2,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    Play,
    Pause,
    ChevronRight,
    Search,
    Filter,
    ClipboardList,
    Loader2,
    Webhook,
    Save
} from 'lucide-react';
import { getDoc, setDoc } from 'firebase/firestore';

interface Lead {
    id?: string;
    name: string;
    email: string;
    phone: string;
    course: string;
    city: string;
    status: 'pending' | 'sending' | 'sent' | 'error';
    scheduledFor?: any;
    sentAt?: any;
    errorMessage?: string;
    companyId: string;
    userId: string;
}

const MetaLeadsModule: React.FC = () => {
    const { userData } = useAuth();
    const [inputText, setInputText] = useState('');
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [activeTab, setActiveTab] = useState<'import' | 'queue' | 'history'>('import');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [sendDelay, setSendDelay] = useState(30); // seconds
    const [isEditingWebhook, setIsEditingWebhook] = useState(false);
    const [isSavingWebhook, setIsSavingWebhook] = useState(false);

    const DEFAULT_WEBHOOK = 'https://n8n.canvazap.com.br/webhook/d7dc1ef8-a1cd-45db-8aae-55c82e28a01f';

    useEffect(() => {
        if (!userData?.companyId) return;

        // Load company configuration
        const loadConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'company_configs', userData.companyId));
                if (configDoc.exists() && configDoc.data().metaLeadsWebhook) {
                    setWebhookUrl(configDoc.data().metaLeadsWebhook);
                } else {
                    setWebhookUrl(DEFAULT_WEBHOOK);
                }
            } catch (error) {
                console.error("Error loading config:", error);
                setWebhookUrl(DEFAULT_WEBHOOK);
            }
        };

        loadConfig();

        // Check for scheduled leads every minute
        const scheduleInterval = setInterval(() => {
            const now = new Date();
            const dueLeads = leads.filter(l =>
                l.status === 'pending' &&
                l.scheduledFor &&
                l.scheduledFor.toDate() <= now
            );
            if (dueLeads.length > 0 && !isSending) {
                console.log("Starting queue for due scheduled leads...");
                startSendingQueue();
            }
        }, 60000);

        const q = query(
            collection(db, 'meta_leads'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leadsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Lead));
            setLeads(leadsList.filter(l => l.companyId === userData.companyId));
        });

        return () => {
            unsubscribe();
            clearInterval(scheduleInterval);
        };
    }, [userData?.companyId, leads, isSending]);

    const parseLeads = () => {
        if (!inputText.trim()) return;
        setIsProcessing(true);

        const lines = inputText.split('\n').filter(l => l.trim());
        const newLeads: Lead[] = [];

        lines.forEach(line => {
            // Try to split by Tab or multiple spaces
            let parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p);

            // Fallback for single space if it looks like a valid line
            if (parts.length < 3) {
                parts = line.split(' ').map(p => p.trim()).filter(p => p);
            }

            if (parts.length >= 3) {
                // Heuristic identification
                let email = '';
                let phone = '';
                let name = '';
                let course = '';
                let city = '';

                parts.forEach(part => {
                    if (part.includes('@')) email = part;
                    else if (/^\+?\d{10,}/.test(part.replace(/\s/g, ''))) phone = part;
                    else if (!name) name = part;
                    else if (part.includes(',') || part.toUpperCase() === part) city = part;
                    else course = part;
                });

                // Correcting order if name was missed or course/city mixed
                if (parts.length === 5) {
                    // Usually: Name, Email, Phone, Course, City
                    name = parts[0];
                    email = parts[1];
                    phone = parts[2];
                    course = parts[3];
                    city = parts[4];
                }

                if (name && (email || phone)) {
                    newLeads.push({
                        name,
                        email,
                        phone,
                        course,
                        city,
                        status: 'pending',
                        companyId: userData?.companyId || '',
                        userId: userData?.uid || '',
                    });
                }
            }
        });

        saveLeadsToFirestore(newLeads);
    };

    const saveLeadsToFirestore = async (leadsToSave: Lead[]) => {
        try {
            const isImmediate = !scheduleDate || !scheduleTime;
            const scheduledDate = !isImmediate
                ? new Date(`${scheduleDate}T${scheduleTime}`)
                : new Date();

            const batch = leadsToSave.map(lead => {
                return addDoc(collection(db, 'meta_leads'), {
                    ...lead,
                    scheduledFor: scheduledDate,
                    createdAt: serverTimestamp()
                });
            });

            await Promise.all(batch);
            setInputText('');

            if (isImmediate) {
                setActiveTab('queue');
                // Auto-start sending if immediate (we wait a bit for snapshot to sync)
                setTimeout(() => {
                    startSendingQueue();
                }, 1500);
            } else {
                setActiveTab('queue');
                alert(`${leadsToSave.length} leads programados para ${scheduleDate} às ${scheduleTime}`);
            }
        } catch (error) {
            console.error("Error saving leads:", error);
            alert("Erro ao salvar leads.");
        } finally {
            setIsProcessing(false);
        }
    };

    const startSendingQueue = async () => {
        if (isSending) return;

        const now = new Date();
        const pendingLeads = leads.filter(l => {
            if (l.status !== 'pending') return false;

            // If it has a scheduled date, check if it's already time
            if (l.scheduledFor) {
                const scheduledDate = l.scheduledFor.toDate ? l.scheduledFor.toDate() : new Date(l.scheduledFor);
                return scheduledDate <= now;Nã
            }

            return true; // If no schedule, it's ready
        });

        if (pendingLeads.length === 0) {
            // Only alert if manually triggered or if specifically immediate
            return;
        }

        setIsSending(true);

        for (const lead of pendingLeads) {
            if (!isSending) break;

            try {
                // Update status to sending
                await updateDoc(doc(db, 'meta_leads', lead.id!), { status: 'sending' });

                // Send to Webhook
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: lead.name,
                        email: lead.email,
                        phone: lead.phone,
                        course: lead.course,
                        city: lead.city,
                        timestamp: new Date().toISOString(),
                        solicitante: userData?.name || 'Sistema'
                    })
                });

                if (response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    // Check if webhook returned a specific failure status
                    if (resData.status === 'error') {
                        throw new Error(resData.message || "Webhook reported error");
                    }

                    await updateDoc(doc(db, 'meta_leads', lead.id!), {
                        status: 'sent',
                        sentAt: serverTimestamp()
                    });
                } else {
                    throw new Error("Webhook rejected request");
                }
            } catch (error: any) {
                console.error("Error sending lead:", error);
                await updateDoc(doc(db, 'meta_leads', lead.id!), {
                    status: 'error',
                    errorMessage: error.message || "Erro desconhecido"
                });
            }

            // Wait the configured delay before next lead
            if (pendingLeads.indexOf(lead) < pendingLeads.length - 1) {
                await new Promise(resolve => setTimeout(resolve, sendDelay * 1000));
            }
        }

        setIsSending(false);
    };

    const sendLeadNow = async (lead: Lead) => {
        try {
            await updateDoc(doc(db, 'meta_leads', lead.id!), { status: 'sending' });
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    course: lead.course,
                    city: lead.city,
                    timestamp: new Date().toISOString(),
                    solicitante: userData?.displayName || 'Sistema (Manual)'
                })
            });

            if (response.ok) {
                await updateDoc(doc(db, 'meta_leads', lead.id!), {
                    status: 'sent',
                    sentAt: serverTimestamp()
                });
            } else {
                throw new Error("Webhook rejected");
            }
        } catch (error: any) {
            console.error(error);
            await updateDoc(doc(db, 'meta_leads', lead.id!), {
                status: 'error',
                errorMessage: error.message
            });
        }
    };

    const deleteLead = async (id: string) => {
        if (window.confirm("Remover este lead da fila?")) {
            await deleteDoc(doc(db, 'meta_leads', id));
        }
    };

    const clearHistory = async () => {
        if (window.confirm("Deseja limpar todo o histórico de envios?")) {
            const sentLeads = leads.filter(l => l.status === 'sent' || l.status === 'error');
            const promises = sentLeads.map(l => deleteDoc(doc(db, 'meta_leads', l.id!)));
            await Promise.all(promises);
        }
    };

    const handleSaveWebhook = async () => {
        if (!userData?.companyId) return;
        setIsSavingWebhook(true);
        try {
            await setDoc(doc(db, 'company_configs', userData.companyId), {
                metaLeadsWebhook: webhookUrl
            }, { merge: true });
            setIsEditingWebhook(false);
        } catch (error) {
            console.error("Error saving webhook:", error);
            alert("Erro ao salvar configuração de webhook.");
        } finally {
            setIsSavingWebhook(false);
        }
    };

    return (
        <div className="module-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="module-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Users size={32} color="var(--primary-color)" />
                        Leads do Meta
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Catalogação e disparo automatizado de leads.</p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                        {isEditingWebhook ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder="URL do Webhook"
                                    style={{ fontSize: '0.75rem', padding: '6px 12px', flex: 1, borderRadius: '8px', border: '1px solid #ddd' }}
                                />
                                <button
                                    onClick={handleSaveWebhook}
                                    disabled={isSavingWebhook}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                    {isSavingWebhook ? <Loader2 className="loading-spinner" size={14} /> : <Save size={14} />}
                                    Salvar
                                </button>
                                <button
                                    onClick={() => setIsEditingWebhook(false)}
                                    style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: '#666', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsEditingWebhook(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.03)', border: '1px dashed #ccc' }}
                            >
                                <Webhook size={14} color="#666" />
                                <span style={{ fontSize: '0.7rem', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {webhookUrl || 'Configurar Webhook'}
                                </span>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.03)', border: '1px solid #eee' }}>
                            <Clock size={14} color="#666" />
                            <span style={{ fontSize: '0.7rem', color: '#666' }}>Intervalo:</span>
                            <input
                                type="number"
                                value={sendDelay}
                                onChange={(e) => setSendDelay(parseInt(e.target.value) || 1)}
                                style={{ width: '40px', border: 'none', background: 'transparent', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color)', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: '#666' }}>seg</span>
                        </div>
                    </div>
                </div>

                <div className="tab-buttons" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setActiveTab('import')}
                        className={`btn ${activeTab === 'import' ? 'btn-primary' : ''}`}
                        style={{ borderRadius: '10px', padding: '8px 16px', background: activeTab === 'import' ? '' : 'transparent', color: activeTab === 'import' ? '' : 'var(--text-secondary)', border: 'none' }}
                    >
                        Importar
                    </button>
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`btn ${activeTab === 'queue' ? 'btn-primary' : ''}`}
                        style={{ borderRadius: '10px', padding: '8px 16px', background: activeTab === 'queue' ? '' : 'transparent', color: activeTab === 'queue' ? '' : 'var(--text-secondary)', border: 'none' }}
                    >
                        Fila de Envio ({leads.filter(l => l.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`btn ${activeTab === 'history' ? 'btn-primary' : ''}`}
                        style={{ borderRadius: '10px', padding: '8px 16px', background: activeTab === 'history' ? '' : 'transparent', color: activeTab === 'history' ? '' : 'var(--text-secondary)', border: 'none' }}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {activeTab === 'import' && (
                <div className="glass-card fade-in" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ClipboardList size={20} />
                        Colar Nova Lista de Leads
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Cole a lista copiada do gerenciador ou CRM. O sistema identificará Nome, Email, Telefone, Curso e Cidade automaticamente.
                    </p>

                    <textarea
                        className="form-input"
                        placeholder="Ex:\nJefferson Araujo jefferson28araujo@icloud.com +5598985983717 MBA em Gestão de Saúde Belem, PARÁ"
                        style={{ width: '100%', minHeight: '300px', padding: '1.5rem', borderRadius: '16px', fontSize: '0.9rem', fontFamily: 'monospace', marginBottom: '1.5rem' }}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />

                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Programar Inicialização (Opcional)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="date"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                />
                                <input
                                    type="time"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            className="btn btn-primary"
                            disabled={!inputText.trim() || isProcessing}
                            onClick={parseLeads}
                            style={{
                                height: '48px',
                                padding: '0 2rem',
                                fontWeight: 700,
                                gap: '8px',
                                background: (!scheduleDate || !scheduleTime) ? '#22c55e' : 'var(--primary-color)',
                                borderColor: (!scheduleDate || !scheduleTime) ? '#22c55e' : 'var(--primary-color)'
                            }}
                        >
                            {isProcessing ? <Loader2 className="loading-spinner" size={20} /> : <Send size={20} />}
                            {(!scheduleDate || !scheduleTime) ? 'Disparar Agora' : 'Programar Disparo'}
                        </button>
                    </div>
                </div>
            )}

            {(activeTab === 'queue' || activeTab === 'history') && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {activeTab === 'queue' ? <Clock size={20} /> : <CheckCircle size={20} />}
                            {activeTab === 'queue' ? 'Leads na Fila' : 'Leads Enviados'}
                        </h3>

                        {activeTab === 'queue' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isSending && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
                                        <Loader2 className="loading-spinner" size={18} />
                                        Processando Fila...
                                    </div>
                                )}
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        if (!isSending) {
                                            startSendingQueue();
                                        } else {
                                            setIsSending(false);
                                        }
                                    }}
                                    style={{ gap: '8px' }}
                                >
                                    {isSending ? <Pause size={18} /> : <Play size={18} />}
                                    {isSending ? 'Pausar' : 'Continuar'}
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-secondary" onClick={clearHistory} style={{ color: '#ef4444' }}>
                                <Trash2 size={18} /> Limpar Histórico
                            </button>
                        )}
                    </div>

                    <div className="glass-card" style={{ overflow: 'hidden', borderRadius: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid #eee' }}>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lead</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contato</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interesse</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</th>
                                    <th style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads
                                    .filter(l => activeTab === 'queue' ? (l.status === 'pending' || l.status === 'sending') : (l.status === 'sent' || l.status === 'error'))
                                    .map(lead => (
                                        <tr key={lead.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{lead.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.city}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontSize: '0.85rem' }}>{lead.email}</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lead.phone}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>{lead.course}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                    {(() => {
                                                        const isFuture = lead.status === 'pending' && lead.scheduledFor &&
                                                            (lead.scheduledFor.toDate ? lead.scheduledFor.toDate() : new Date(lead.scheduledFor)) > new Date();

                                                        return (
                                                            <>
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 800,
                                                                    textTransform: 'uppercase',
                                                                    background: lead.status === 'sent' ? '#dcfce7' : isFuture ? '#e0f2fe' : lead.status === 'pending' ? '#f1f5f9' : lead.status === 'sending' ? '#fef3c7' : '#fee2e2',
                                                                    color: lead.status === 'sent' ? '#166534' : isFuture ? '#0369a1' : lead.status === 'pending' ? '#64748b' : lead.status === 'sending' ? '#92400e' : '#991b1b'
                                                                }}>
                                                                    {lead.status === 'sent' ? 'Enviado' : isFuture ? 'Programado' : lead.status === 'pending' ? 'Pendente' : lead.status === 'sending' ? 'Enviando...' : 'Erro'}
                                                                </span>
                                                                {isFuture && lead.scheduledFor && (
                                                                    <span style={{ fontSize: '0.65rem', color: '#0369a1', fontWeight: 600 }}>
                                                                        {new Date(lead.scheduledFor.toDate ? lead.scheduledFor.toDate() : lead.scheduledFor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                    {lead.status === 'error' && lead.errorMessage && (
                                                        <span style={{ fontSize: '0.65rem', color: '#991b1b', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lead.errorMessage}>
                                                            {lead.errorMessage}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {lead.status !== 'sending' && (
                                                        <button className="btn-icon" title="Enviar Agora" onClick={() => sendLeadNow(lead)} style={{ color: 'var(--primary-color)' }}>
                                                            <Send size={16} />
                                                        </button>
                                                    )}
                                                    <button className="btn-icon" onClick={() => deleteLead(lead.id!)} style={{ color: '#ef4444', opacity: 0.6 }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                {leads.filter(l => activeTab === 'queue' ? (l.status === 'pending' || l.status === 'sending') : (l.status === 'sent' || l.status === 'error')).length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            Nenhum lead encontrado nesta visualização.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetaLeadsModule;
