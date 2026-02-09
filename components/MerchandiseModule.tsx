import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Search, Filter, Camera, Trash2, User, ChevronLeft, ChevronRight, X, Download, Terminal, Activity, Clipboard, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MerchandiseEntry {
    id: string;
    companyId: string;
    sender: string;
    senderName: string;
    groupId: string;
    groupName: string;
    imageUrl: string;
    caption: string;
    createdAt: string;
    receivedAt: string;
    status: 'new' | 'reviewed';
}

interface WebhookLog {
    id: string;
    timestamp: string;
    method: string;
    headers: any;
    body: any;
}

const MerchandiseModule = () => {
    const { userData } = useAuth();
    const [entries, setEntries] = useState<MerchandiseEntry[]>([]);
    const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState<MerchandiseEntry | null>(null);
    const [viewMode, setViewMode] = useState<'gallery' | 'webhook'>('gallery');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    useEffect(() => {
        let q;
        if (userData?.role === 'super_admin' || !userData?.companyId) {
            q = query(
                collection(db, 'merchandise_entries'),
                orderBy('receivedAt', 'desc')
            );
        } else {
            q = query(
                collection(db, 'merchandise_entries'),
                where('companyId', '==', userData.companyId),
                orderBy('receivedAt', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MerchandiseEntry[];
            setEntries(data);
            setLoading(false);
        });

        const webhookQ = query(
            collection(db, 'webhook_logs'),
            orderBy('timestamp', 'desc')
        );

        const unsubscribeLogs = onSnapshot(webhookQ, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WebhookLog[];
            setWebhookLogs(data.slice(0, 20));
        });

        return () => {
            unsubscribe();
            unsubscribeLogs();
        };
    }, [userData]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta foto?')) {
            try {
                await deleteDoc(doc(db, 'merchandise_entries', id));
                if (selectedImage?.id === id) setSelectedImage(null);
            } catch (error) {
                console.error("Error deleting entry:", error);
            }
        }
    };

    const filteredEntries = entries.filter(entry =>
        entry.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.caption.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div className="fade-in" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Camera className="text-primary" size={32} />
                        Merchandising & Execução
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Monitore as execuções de gôndola enviadas via WhatsApp.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <div className="glass-card" style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', padding: '4px' }}>
                        <button
                            onClick={() => setViewMode('gallery')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: viewMode === 'gallery' ? 'var(--primary-color)' : 'transparent',
                                color: viewMode === 'gallery' ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Camera size={16} /> Galeria
                        </button>
                        <button
                            onClick={() => setViewMode('webhook')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: viewMode === 'webhook' ? 'var(--primary-color)' : 'transparent',
                                color: viewMode === 'webhook' ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Terminal size={16} /> Webhook JSON
                        </button>
                    </div>

                    {viewMode === 'gallery' && (
                        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem' }}>
                            <Search size={18} color="var(--text-secondary)" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-color)', minWidth: '200px' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'gallery' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {filteredEntries.map(entry => (
                        <div
                            key={entry.id}
                            className="glass-card section-fade-in"
                            onClick={() => setSelectedImage(entry)}
                            style={{
                                padding: 0,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                transition: 'transform 0.2s',
                                position: 'relative',
                                aspectRatio: '3/4'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <img src={entry.imageUrl} alt={entry.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                padding: '1rem',
                                color: 'white'
                            }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{entry.senderName}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                    {format(new Date(entry.receivedAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </div>
                                {entry.groupName && (
                                    <div style={{ fontSize: '0.7rem', marginTop: '4px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {entry.groupName}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={(e) => handleDelete(entry.id, e)}
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '8px', borderRadius: '50%' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {filteredEntries.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            <Camera size={48} style={{ opacity: 0.2, marginBottom: '1rem', margin: '0 auto' }} />
                            <p>Nenhuma foto encontrada.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="fade-in">
                    <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                            <div style={{ background: 'var(--primary-color)', color: 'white', padding: '8px', borderRadius: '10px' }}>
                                <Activity size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: '1rem' }}>Informações de Conexão</h3>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Configure seu n8n com os dados abaixo</p>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '4px' }}>ENDPOINT URL (POST)</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', flex: 1 }}>https://ecossistema.com.br/api/webhook-merchan</code>
                                    <button onClick={() => { navigator.clipboard.writeText('https://ecossistema.com.br/api/webhook-merchan'); alert('URL Copiada!'); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Clipboard size={16} /></button>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '4px' }}>MÉTODO</div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>POST</div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)' }}>
                            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Terminal size={18} /> Últimos Payloads</h3>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Atualização em tempo real</span>
                        </div>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {webhookLogs.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>
                                    <Activity size={48} style={{ margin: '0 auto 1rem' }} />
                                    <p>Aguardando primeiro envio do n8n...</p>
                                </div>
                            ) : (
                                webhookLogs.map((log) => (
                                    <div key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <div onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: expandedLog === log.id ? 'rgba(59, 130, 246, 0.03)' : 'transparent' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>{log.method}</div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{format(new Date(log.timestamp), "HH:mm:ss 'em' dd/MM")}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>ID: {log.id}</div>
                                                </div>
                                            </div>
                                            <div style={{ transform: expandedLog === log.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><ChevronRight size={18} /></div>
                                        </div>
                                        {expandedLog === log.id && (
                                            <div style={{ padding: '0 1.2rem 1.2rem', background: 'rgba(59, 130, 246, 0.03)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Headers</label>
                                                        <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem', overflowX: 'auto' }}>{JSON.stringify(log.headers, null, 2)}</pre>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>JSON Body</label>
                                                        <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem', overflowX: 'auto' }}>{JSON.stringify(log.body, null, 2)}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={() => setSelectedImage(null)}>
                    <div style={{ position: 'relative', width: '90vw', maxWidth: '900px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <img src={selectedImage.imageUrl} alt="Full view" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'block', margin: '0 auto' }} />
                        <div style={{ position: 'absolute', bottom: '-70px', left: 0, right: 0, textAlign: 'center', color: 'white' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedImage.senderName}</h3>
                            <p style={{ opacity: 0.8 }}>{selectedImage.caption || 'Sem legenda'}</p>
                        </div>
                        <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={32} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MerchandiseModule;
