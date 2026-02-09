
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, limit, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Bell,
    CheckCircle2,
    Clock,
    Trash2,
    Eye,
    Filter,
    XCircle,
    Info,
    AlertTriangle,
    Check,
    Loader2,
    ChevronRight,
    Search,
    RefreshCw
} from 'lucide-react';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'approval';
    status: 'read' | 'unread';
    createdAt: any;
    link?: string;
    category?: string;
}

const AdminNotifications = () => {
    const { userData } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'admin_notifications'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification));
            setNotifications(list);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching notifications", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, 'admin_notifications', id), {
                status: 'read',
                readAt: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => n.status === 'unread');
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(n => {
            batch.update(doc(db, 'admin_notifications', n.id), {
                status: 'read',
                readAt: serverTimestamp()
            });
        });

        try {
            await batch.commit();
            alert('Todas as notificações foram marcadas como lidas.');
        } catch (e) {
            console.error(e);
        }
    };

    const deleteNotification = async (id: string) => {
        if (!confirm('Excluir esta notificação?')) return;
        try {
            await deleteDoc(doc(db, 'admin_notifications', id));
        } catch (e) {
            console.error(e);
        }
    };

    const clearAll = async () => {
        if (!confirm('Tem certeza que deseja limpar todas as notificações?')) return;
        const batch = writeBatch(db);
        notifications.forEach(n => {
            batch.delete(doc(db, 'admin_notifications', n.id));
        });

        try {
            await batch.commit();
            alert('Histórico de notificações limpo.');
        } catch (e) {
            console.error(e);
        }
    };

    const filtered = notifications.filter(n => {
        const matchesFilter = filter === 'all' || n.status === filter;
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.message.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="text-success" size={20} />;
            case 'warning': return <AlertTriangle style={{ color: '#F59E0B' }} size={20} />;
            case 'error': return <XCircle style={{ color: '#ef4444' }} size={20} />;
            case 'approval': return <Clock style={{ color: 'var(--primary-color)' }} size={20} />;
            default: return <Info className="text-primary" size={20} />;
        }
    };

    if (userData?.role !== 'super_admin') return <div className="p-8">Acesso restrito.</div>;

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem' }}>Notificações Mastér 🔔</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Fique por dentro de tudo que acontece no sistema.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={markAllAsRead} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                        <Check size={18} /> Marcar todas como lidas
                    </button>
                    <button onClick={clearAll} className="btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', color: '#ef4444' }}>
                        <Trash2 size={18} /> Limpar tudo
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por título ou mensagem..."
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
                            style={{ width: '150px' }}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                        >
                            <option value="all">Todas</option>
                            <option value="unread">Não lidas</option>
                            <option value="read">Lidas</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 className="loading-spinner" size={40} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '5rem' }}>
                    <Bell size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                    <h3 style={{ color: 'var(--text-secondary)' }}>Nenhuma notificação por aqui.</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Você está em dia com tudo!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filtered.map((note) => (
                        <div
                            key={note.id}
                            className="glass-card fade-in notification-item"
                            style={{
                                padding: '1.2rem 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.5rem',
                                opacity: note.status === 'read' ? 0.7 : 1,
                                borderLeft: note.status === 'unread' ? '4px solid var(--primary-color)' : '4px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                            }}>
                                {getIcon(note.type)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{note.title}</h4>
                                    {note.status === 'unread' && (
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }}></span>
                                    )}
                                </div>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{note.message}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString() : 'Recentemente'}
                                    </div>
                                    {note.category && (
                                        <div style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                            {note.category}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {note.status === 'unread' && (
                                    <button
                                        onClick={() => markAsRead(note.id)}
                                        className="btn-icon"
                                        title="Marcar como lida"
                                        style={{ color: 'var(--primary-color)' }}
                                    >
                                        <Eye size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteNotification(note.id)}
                                    className="btn-icon"
                                    title="Excluir"
                                    style={{ color: '#ef4444' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                                {note.link && (
                                    <a href={note.link} className="btn-icon" title="Ver detalhes" style={{ color: 'var(--text-secondary)' }}>
                                        <ChevronRight size={18} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .notification-item:hover {
                    transform: translateX(5px);
                    background: white !important;
                    border-color: var(--border-color) !important;
                }
            `}</style>
        </div>
    );
};

export default AdminNotifications;
