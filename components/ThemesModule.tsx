
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, getDocs, doc, setDoc, deleteDoc, where, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Search, Plus, Edit, Trash2, Image as ImageIcon, Check, X, Globe, Lock, ArrowLeft, Copy } from 'lucide-react';

interface Theme {
    id: string;
    name: string;
    tags: string[];
    backgroundLaminas: string;
    backgroundEncartes: string;
    sealUrl: string;
    priceSealUrl: string;
    availability: string[]; // 'laminas', 'encartes'
    isPublic: boolean;
    companyId: string;
    status: 'active' | 'pending' | 'archived';
    createdAt: any;
    defaultLayoutConfig?: any; // Stores the saved layout configuration
}

const ThemesModule = () => {
    const { userData } = useAuth();
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'global'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'list' | 'form'>('list');


    const [editingTheme, setEditingTheme] = useState<Theme | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        tags: '',
        backgroundLaminas: '',
        backgroundEncartes: '',
        sealUrl: '',
        priceSealUrl: '',
        availability: [] as string[],
        isPublic: false
    });

    useEffect(() => {
        if (userData?.companyId) {
            fetchThemes();
        }
    }, [userData, activeTab]);

    const fetchThemes = async () => {
        setLoading(true);
        try {
            let q;
            const themesRef = collection(db, 'themes');

            if (activeTab === 'global') {
                q = query(themesRef, where('isPublic', '==', true));
            } else if (activeTab === 'pending') {
                // Assuming 'pending' means public themes waiting approval or just local unfinished? 
                // Based on image 'Pendentes de Aprovação', likely an admin workflow.
                // For now let's just fetch all status='pending' if admin, or my pending.
                q = query(themesRef, where('status', '==', 'pending'));
            } else {
                // All: My Private + All Public
                // Firestore doesn't support logical OR directly in one query easily for this mix without duplicates or multiple queries.
                // Let's fetch all and filter client side for simplicity in this prototype, 
                // or fetch public and my private separately and merge.
                const publicQ = query(themesRef, where('isPublic', '==', true));
                const myQ = query(themesRef, where('companyId', '==', userData?.companyId));

                const [publicSnap, mySnap] = await Promise.all([getDocs(publicQ), getDocs(myQ)]);

                const merged = new Map();
                publicSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() as any }));
                mySnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() as any }));

                setThemes(Array.from(merged.values()) as Theme[]);
                setLoading(false);
                return;
            }

            const snapshot = await getDocs(q);
            setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));

        } catch (error) {
            console.error("Error fetching themes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTheme = async () => {
        try {
            const themeId = editingTheme ? editingTheme.id : `theme_${Date.now()}`;
            const themeData: any = {
                name: formData.name,
                tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
                backgroundLaminas: formData.backgroundLaminas,
                backgroundEncartes: formData.backgroundEncartes,
                sealUrl: formData.sealUrl,
                priceSealUrl: formData.priceSealUrl,
                availability: formData.availability,
                isPublic: formData.isPublic,
                updatedAt: new Date(),
                status: 'active', // Default to active for now
                defaultLayoutConfig: editingTheme?.defaultLayoutConfig || {} // Preserve layout config
            };

            if (!editingTheme) {
                themeData.createdAt = new Date();
                themeData.companyId = userData?.companyId;
            }

            await setDoc(doc(db, 'themes', themeId), themeData, { merge: true });
            setView('list');
            resetForm();
            fetchThemes();
        } catch (error) {
            console.error("Error saving theme:", error);
            alert("Erro ao salvar tema");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este tema?")) return;
        await deleteDoc(doc(db, 'themes', id));
        setThemes(prev => prev.filter(t => t.id !== id));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            tags: '',
            backgroundLaminas: '',
            backgroundEncartes: '',
            sealUrl: '',
            priceSealUrl: '',
            availability: [],
            isPublic: false
        });
        setEditingTheme(null);
    };

    const openEdit = (theme: Theme) => {
        setEditingTheme(theme);
        setFormData({
            name: theme.name,
            tags: theme.tags.join(', '),
            backgroundLaminas: theme.backgroundLaminas,
            backgroundEncartes: theme.backgroundEncartes,
            sealUrl: theme.sealUrl,
            priceSealUrl: theme.priceSealUrl,
            availability: theme.availability,
            isPublic: theme.isPublic
        });
        setView('form');
    };

    const handleCreate = () => {
        resetForm();
        setView('form');
    }

    const handleDuplicate = async (theme: Theme) => {
        if (!userData?.companyId) return;
        if (!confirm(`Deseja duplicar o tema "${theme.name}"?`)) return;

        try {
            const newThemeData = {
                name: `${theme.name} (Cópia)`,
                tags: theme.tags || [],
                backgroundLaminas: '', // Clear images
                backgroundEncartes: '', // Clear images
                sealUrl: '',
                priceSealUrl: '',
                availability: theme.availability || [],
                companyId: userData.companyId,
                isPublic: false, // Default to private
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                defaultLayoutConfig: theme.defaultLayoutConfig || {} // Preserve layout config
            };

            await addDoc(collection(db, 'themes'), newThemeData);
            alert('Tema duplicado com sucesso!');
            fetchThemes();
        } catch (error) {
            console.error("Erro ao duplicar tema:", error);
            alert("Erro ao duplicar tema.");
        }
    };

    // Filter Logic
    const filteredThemes = themes.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (view === 'form') {
        return (
            <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                    <button onClick={() => setView('list')} className="btn-icon" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', width: 40, height: 40 }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="title" style={{ marginBottom: 0 }}>{editingTheme ? 'Editar Tema' : 'Novo Tema'}</h1>
                    </div>
                </div>

                <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                    <div style={{ display: 'grid', gap: '2rem' }}>
                        {/* Basics */}
                        <section>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informações Principais</h3>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Nome do Tema</label>
                                    <input
                                        className="form-input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: Promoção de Natal"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Tags (separadas por vírgula)</label>
                                    <input className="form-input" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} placeholder="Ex: natal, oferta, fim de ano" />
                                </div>
                            </div>
                        </section>

                        {/* Images */}
                        <section>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Imagens (URLs)</h3>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">URL Fundo (Lâminas)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input className="form-input" value={formData.backgroundLaminas} onChange={e => setFormData({ ...formData, backgroundLaminas: e.target.value })} placeholder="https://..." />
                                        {formData.backgroundLaminas && <div style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}><img src={formData.backgroundLaminas} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">URL Fundo (Encartes)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input className="form-input" value={formData.backgroundEncartes} onChange={e => setFormData({ ...formData, backgroundEncartes: e.target.value })} placeholder="https://..." />
                                        {formData.backgroundEncartes && <div style={{ width: 40, height: 40, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}><img src={formData.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label className="form-label">URL Selo</label>
                                        <input className="form-input" value={formData.sealUrl} onChange={e => setFormData({ ...formData, sealUrl: e.target.value })} placeholder="https://..." />
                                    </div>
                                    <div>
                                        <label className="form-label">URL Selo Preço</label>
                                        <input className="form-input" value={formData.priceSealUrl} onChange={e => setFormData({ ...formData, priceSealUrl: e.target.value })} placeholder="https://..." />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Settings */}
                        <section>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configurações</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Disponibilidade</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.availability.includes('laminas')}
                                                onChange={e => {
                                                    const newArr = e.target.checked
                                                        ? [...formData.availability, 'laminas']
                                                        : formData.availability.filter(x => x !== 'laminas');
                                                    setFormData({ ...formData, availability: newArr });
                                                }}
                                            />
                                            Lâminas
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.availability.includes('encartes')}
                                                onChange={e => {
                                                    const newArr = e.target.checked
                                                        ? [...formData.availability, 'encartes']
                                                        : formData.availability.filter(x => x !== 'encartes');
                                                    setFormData({ ...formData, availability: newArr });
                                                }}
                                            />
                                            Encartes
                                        </label>
                                    </div>
                                </div>

                                {userData?.role === 'admin' && (
                                    <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                        <div style={{ position: 'relative', width: '40px', height: '24px', background: formData.isPublic ? 'var(--primary-color)' : '#cbd5e1', borderRadius: '12px', transition: '0.2s', marginTop: '2px', cursor: 'pointer' }} onClick={() => setFormData({ ...formData, isPublic: !formData.isPublic })}>
                                            <div style={{ position: 'absolute', left: formData.isPublic ? '18px' : '2px', top: '2px', width: '20px', height: '20px', background: 'white', borderRadius: '50%', transition: '0.2s' }}></div>
                                        </div>
                                        <div>
                                            <label style={{ cursor: 'pointer', fontWeight: 600, display: 'block' }} onClick={() => setFormData({ ...formData, isPublic: !formData.isPublic })}>
                                                Tema Público (Global)
                                            </label>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                Este tema será visível para <strong>todas as empresas</strong> cadastradas no sistema.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <button className="btn-secondary" onClick={() => setView('list')}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveTheme}>
                            {editingTheme ? 'Salvar Alterações' : 'Criar Tema'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="title">Gerenciamento de Temas</h1>
                    <p className="subtitle">Visualize e gerencie os temas disponíveis para criação de artes.</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    <Plus size={18} /> Criar Tema
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <button
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'all' ? '2px solid var(--primary-color)' : 'none', fontWeight: activeTab === 'all' ? 600 : 400, cursor: 'pointer', color: activeTab === 'all' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                >
                    Todos os Temas
                </button>
                <button
                    className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'pending' ? '2px solid var(--primary-color)' : 'none', fontWeight: activeTab === 'pending' ? 600 : 400, cursor: 'pointer', color: activeTab === 'pending' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                >
                    Pendentes
                </button>
                <button
                    className={`tab-btn ${activeTab === 'global' ? 'active' : ''}`}
                    onClick={() => setActiveTab('global')}
                    style={{ padding: '0.5rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'global' ? '2px solid var(--primary-color)' : 'none', fontWeight: activeTab === 'global' ? 600 : 400, cursor: 'pointer', color: activeTab === 'global' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                >
                    Temas Globais
                </button>
            </div>

            {/* Filters */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="Buscar por nome ou tag..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredThemes.map(theme => (
                    <div key={theme.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {/* Preview */}
                        <div style={{ height: '160px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {theme.backgroundLaminas || theme.backgroundEncartes ? (
                                <img src={theme.backgroundLaminas || theme.backgroundEncartes} alt={theme.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ImageIcon size={20} /> Sem imagem
                                </span>
                            )}

                            {/* Badges */}
                            <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '0.5rem' }}>
                                {theme.isPublic ? (
                                    <span style={{ background: 'var(--primary-color)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Globe size={10} /> Público
                                    </span>
                                ) : (
                                    <span style={{ background: '#64748b', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Lock size={10} /> Privado
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{theme.name}</h3>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                {theme.tags.map(tag => (
                                    <span key={tag} style={{ fontSize: '0.75rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {theme.availability.join(', ')}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {(userData?.role === 'admin' || theme.companyId === userData?.companyId) && (
                                        <button
                                            className="btn-icon"
                                            title="Duplicar"
                                            onClick={() => handleDuplicate(theme)}
                                        >
                                            <Copy size={16} />
                                        </button>
                                    )}
                                    <button
                                        className="btn-icon"
                                        onClick={() => openEdit(theme)}
                                        disabled={theme.companyId !== userData?.companyId && userData?.role !== 'admin'}
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        style={{ color: 'var(--error-color)' }}
                                        onClick={() => handleDelete(theme.id)}
                                        disabled={theme.companyId !== userData?.companyId && userData?.role !== 'admin'}
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}

        </div>
    );
};

export default ThemesModule;
