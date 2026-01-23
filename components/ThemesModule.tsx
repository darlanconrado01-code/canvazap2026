
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, getDocs, doc, setDoc, deleteDoc, where, orderBy, addDoc, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Search, Plus, Edit, Trash2, Image as ImageIcon, Check, X, Globe, Lock, ArrowLeft, Copy, Building2, AlertCircle, Settings, Save, Layout, Type, Grid, ChevronDown } from 'lucide-react';

interface Theme {
    id: string;
    name: string;
    tags: string[];
    backgroundEncartes: string;
    coverUrl?: string;
    isActive: boolean;
    availability: string[]; // 'encartes', 'catalogo'
    isPublic: boolean;
    companyId: string;
    allowedCompanies?: string[]; // Companies that can see this theme (if not public)
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
    const [view, setView] = useState<'list' | 'form' | 'settings'>('list');
    const [allCompanies, setAllCompanies] = useState<any[]>([]);
    const [activeThemeForSettings, setActiveThemeForSettings] = useState<Theme | null>(null);

    const [editingTheme, setEditingTheme] = useState<Theme | null>(null);

    // Layout Config State for Master (Complete Baseline)
    const [layoutConfig, setLayoutConfig] = useState({
        columns: 3, rows: 4, gap: 16,
        marginTop: 180, marginBottom: 100, marginLeft: 20, marginRight: 20,
        colorDescription: '#000000', colorPrice: '#cc0000', colorCode: '#666666',
        colorInternalCode: '#666666', colorEan: '#666666', colorPackaging: '#000000',
        showPriceSeal: true, showInternalCode: true, showEan: false,
        fontInternalCode: 0.8, fontEan: 0.8, fontSizeDescription: 1.1, fontSizePrice: 2,
        cardBackgroundMode: 'none', cardOpacity: 0.8, cardRadius: 8, cardPadding: 10,
        spacingBelowPhoto: 5, spacingBelowDescription: 5, spacingAbovePrice: 5,
        priceCentsSpacing: 2, photoScale: 1,
        elementsOrder: ['code', 'description', 'price'], // New: Order of elements
        logoConfig: { x: 23.5, y: 82, scale: 1.6, visible: true },
        sideTextConfig: {
            text: 'Imagens meramente ilustrativas', fontSize: 14, color: '#333333',
            x: 2, y: 200, scale: 1, rotation: -90, visible: true
        }
    });

    const [mockProducts, setMockProducts] = useState([
        { id: '1', description: 'ARROZ TIPO 1 5KG', price: '29,90', imageUrl: 'https://images.tcdn.com.br/img/img_prod/735623/arroz_agulhinha_tipo_1_camil_5kg_871_1_20200831102941.jpg', code: '1001' },
        { id: '2', description: 'FEIJÃO CARIOCA 1KG', price: '7,49', imageUrl: 'https://cdn.awsli.com.br/600x450/1183/1183350/produto/166068305/be309a4734.jpg', code: '1002' },
        { id: '3', description: 'ÓLEO DE SOJA 900ML', price: '6,25', imageUrl: 'https://imagensemoldes.com.br/wp-content/uploads/2020/04/Foto-de-Ol%C3%A9o-de-Soja-Liza-PNG.png', code: '1003' },
        { id: '4', description: 'LEITE INTEGRAL 1L', price: '4,69', imageUrl: 'https://static.paodeacucar.com.br/img/uploads/1/541/658541.png', code: '1004' },
        { id: '5', description: 'CAFÉ TORRADO 500G', price: '18,90', imageUrl: 'https://images.tcdn.com.br/img/img_prod/741824/cafe_melitta_tradicional_500g_245_1_20200520163353.jpg', code: '1005' },
        { id: '6', description: 'AÇÚCAR REFINADO 1KG', price: '4,25', imageUrl: 'https://static.paodeacucar.com.br/img/uploads/1/10/615010.png', code: '1006' }
    ]);

    useEffect(() => {
        if (userData) {
            fetchThemes();
            if (userData.isSystemAdmin) {
                fetchCompanies();
            }
        }
    }, [userData?.uid, userData?.companyId, activeTab]);

    useEffect(() => {
        if (userData && view === 'settings') {
            fetchRealProductsForPreview();
        }
    }, [userData?.uid, view]);

    const fetchRealProductsForPreview = async () => {
        try {
            const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(12));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const products = snap.docs.map(d => ({
                    id: d.id,
                    description: d.data().name || d.data().description,
                    price: d.data().price || '0,00',
                    imageUrl: d.data().imageUrl || d.data().photoUrl,
                    code: d.data().internalCode || ''
                })).filter(p => p.imageUrl);

                if (products.length > 0) {
                    setMockProducts(products);
                }
            }
        } catch (err) {
            console.warn("Usando mock de produtos (erro ao buscar reais):", err);
        }
    };

    const fetchCompanies = async () => {
        try {
            const snap = await getDocs(collection(db, 'companies'));
            setAllCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching companies:", error);
        }
    };

    const fetchThemes = async () => {
        setLoading(true);
        try {
            const themesRef = collection(db, 'themes');

            if (activeTab === 'global') {
                const q = query(themesRef, where('isPublic', '==', true));
                const snapshot = await getDocs(q);
                setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
            } else if (activeTab === 'pending') {
                const q = query(themesRef, where('status', '==', 'pending'));
                const snapshot = await getDocs(q);
                setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
            } else {
                if (userData?.isSystemAdmin) {
                    const snapshot = await getDocs(themesRef);
                    setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
                } else {
                    const publicQ = query(themesRef, where('isPublic', '==', true));
                    const myQ = userData?.companyId ? query(themesRef, where('companyId', '==', userData.companyId)) : null;
                    const allowedQ = userData?.companyId ? query(themesRef, where('allowedCompanies', 'array-contains', userData.companyId)) : null;

                    const promises = [getDocs(publicQ)];
                    if (myQ) promises.push(getDocs(myQ));
                    if (allowedQ) promises.push(getDocs(allowedQ));

                    const snapshots = await Promise.all(promises);
                    const merged = new Map();
                    snapshots.forEach(snap => {
                        snap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() as any }));
                    });

                    setThemes(Array.from(merged.values()) as Theme[]);
                }
            }

        } catch (error) {
            console.error("Error fetching themes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLayoutPadrão = async () => {
        if (!activeThemeForSettings) return;

        // Proteção MASTER: Somente Super Admin altera layout de temas públicos
        if (activeThemeForSettings.isPublic && !userData?.isSystemAdmin) {
            alert('Apenas administradores do sistema podem alterar o layout padrão de temas globais.');
            return;
        }

        try {
            await setDoc(doc(db, 'themes', activeThemeForSettings.id), {
                defaultLayoutConfig: layoutConfig
            }, { merge: true });
            alert('Configurações padrão do tema atualizadas!');
            setView('list');
            fetchThemes();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar ajustes');
        }
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '', tags: '', backgroundEncartes: '',
        coverUrl: '', isActive: true, availability: [] as string[],
        isPublic: false, allowedCompanies: [] as string[]
    });

    const resetForm = () => {
        setFormData({
            name: '', tags: '', backgroundEncartes: '',
            coverUrl: '', isActive: true, availability: [],
            isPublic: false, allowedCompanies: []
        });
        setEditingTheme(null);
    };

    const handleSaveTheme = async () => {
        try {
            const themeId = editingTheme ? editingTheme.id : `theme_${Date.now()}`;

            // Lógica de Status e Publicidade
            let finalIsPublic = false;
            let finalStatus: 'active' | 'pending' | 'archived' = 'active';

            if (userData?.isSystemAdmin) {
                finalIsPublic = formData.isPublic;
                finalStatus = 'active';
            } else {
                if (formData.isPublic) {
                    finalStatus = 'pending';
                    finalIsPublic = false;
                } else {
                    finalStatus = 'active';
                    finalIsPublic = false;
                }
            }

            const themeData: any = {
                name: formData.name,
                tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
                backgroundEncartes: formData.backgroundEncartes,
                coverUrl: formData.coverUrl,
                isActive: formData.isActive,
                availability: formData.availability,
                isPublic: finalIsPublic,
                status: finalStatus,
                allowedCompanies: formData.allowedCompanies,
                updatedAt: new Date()
            };

            if (!editingTheme) {
                themeData.createdAt = new Date();
                themeData.companyId = userData?.companyId;
            }

            await setDoc(doc(db, 'themes', themeId), themeData, { merge: true });
            if (finalStatus === 'pending') alert('Solicitação enviada para análise!');

            setView('list');
            resetForm();
            fetchThemes();
        } catch (error) {
            console.error("Error saving theme:", error);
            alert("Erro ao salvar tema");
        }
    };

    const handleApproveTheme = async (theme: Theme) => {
        if (!userData?.isSystemAdmin) return;
        if (!confirm(`Deseja aprovar o tema "${theme.name}" para ser Global?`)) return;
        try {
            await setDoc(doc(db, 'themes', theme.id), { status: 'active', isPublic: true, updatedAt: new Date() }, { merge: true });
            alert('Tema aprovado e agora é GLOBAL!');
            fetchThemes();
        } catch (error) {
            console.error(error);
            alert('Erro ao aprovar tema.');
        }
    };

    const handleRejectTheme = async (theme: Theme) => {
        if (!userData?.isSystemAdmin) return;
        if (!confirm(`Deseja rejeitar a solicitação global do tema "${theme.name}"?`)) return;
        try {
            await setDoc(doc(db, 'themes', theme.id), { status: 'active', isPublic: false, updatedAt: new Date() }, { merge: true });
            alert('Solicitação rejeitada.');
            fetchThemes();
        } catch (error) {
            console.error(error);
            alert('Erro ao processar rejeição.');
        }
    };

    const handleDelete = async (theme: Theme) => {
        // Proteção MASTER
        if (theme.isPublic && !userData?.isSystemAdmin) {
            alert('Você não pode excluir um tema global do sistema.');
            return;
        }

        if (!confirm(`Tem certeza que deseja excluir o tema "${theme.name}"?`)) return;
        try {
            await deleteDoc(doc(db, 'themes', theme.id));
            setThemes(prev => prev.filter(t => t.id !== theme.id));
        } catch (err) {
            console.error("Error deleting theme:", err);
            alert("Erro ao excluir tema");
        }
    };

    const openEdit = (theme: Theme) => {
        setEditingTheme(theme);
        setFormData({
            name: theme.name, tags: theme.tags.join(', '),
            backgroundEncartes: theme.backgroundEncartes,
            coverUrl: theme.coverUrl || '',
            isActive: theme.isActive !== undefined ? theme.isActive : true,
            availability: theme.availability, isPublic: theme.isPublic,
            allowedCompanies: theme.allowedCompanies || []
        });
        setView('form');
    };

    const openSettings = (theme: Theme) => {
        setActiveThemeForSettings(theme);
        if (theme.defaultLayoutConfig) {
            setLayoutConfig({ ...layoutConfig, ...theme.defaultLayoutConfig, elementsOrder: theme.defaultLayoutConfig.elementsOrder || ['code', 'description', 'price'] });
        }
        setView('settings');
    };

    const handleCreate = () => { resetForm(); setView('form'); }

    const handleDuplicate = async (theme: Theme) => {
        if (!userData?.companyId) return;
        if (!confirm(`Deseja duplicar o tema "${theme.name}"?`)) return;

        try {
            const newThemeData = {
                name: `${theme.name} (Cópia)`,
                tags: theme.tags || [],
                backgroundEncartes: theme.backgroundEncartes || '',
                coverUrl: theme.coverUrl || '',
                isActive: theme.isActive ?? true,
                availability: theme.availability || [],
                companyId: userData.companyId, isPublic: false,
                status: 'active', createdAt: new Date(), updatedAt: new Date(),
                defaultLayoutConfig: theme.defaultLayoutConfig || {}
            };
            await addDoc(collection(db, 'themes'), newThemeData);
            alert('Tema duplicado com sucesso!');
            fetchThemes();
        } catch (error) {
            console.error("Erro ao duplicar tema:", error);
            alert("Erro ao duplicar tema.");
        }
    };

    const filteredThemes = themes.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (view === 'settings') {
        return (
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setView('list')} className="btn-icon" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="title" style={{ marginBottom: 0 }}>Ajustes de Layout: {activeThemeForSettings?.name}</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Defina o padrão visual deste tema para todas as empresas.</p>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleSaveLayoutPadrão}><Save size={18} /> Salvar Padrão Global</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem', height: 'calc(100vh - 250px)' }}>
                    <div className="glass-card" style={{ overflowY: 'auto', padding: '1rem', scrollbarWidth: 'thin' }}>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <details className="settings-group" open>
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Cores</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    {[
                                        { label: 'Descrição', key: 'colorDescription' },
                                        { label: 'Preço', key: 'colorPrice' },
                                        { label: 'Cód. Interno', key: 'colorInternalCode' },
                                        { label: 'EAN', key: 'colorEan' }
                                    ].map(item => (
                                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.9rem', color: '#444' }}>{item.label}</label>
                                            <input
                                                type="color"
                                                value={(layoutConfig as any)[item.key]}
                                                onChange={e => setLayoutConfig({ ...layoutConfig, [item.key]: e.target.value })}
                                                style={{ width: '40px', height: '24px', border: '1px solid #ddd', cursor: 'pointer', padding: '2px', background: 'white' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </details>

                            {/* Section: Ordem dos Elementos */}
                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Ordem dos Textos</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(layoutConfig.elementsOrder || ['code', 'description', 'price']).map((item, index) => (
                                            <div
                                                key={item}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    background: 'var(--surface-color)',
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            >
                                                <Grid size={14} color="var(--text-muted)" />
                                                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>
                                                    {item === 'code' ? 'Códigos (Cód/EAN)' : item === 'description' ? 'Descrição' : 'Preço Principal'}
                                                </span>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        disabled={index === 0}
                                                        onClick={() => {
                                                            const nextOrder = [...(layoutConfig.elementsOrder || [])];
                                                            const temp = nextOrder[index];
                                                            nextOrder[index] = nextOrder[index - 1];
                                                            nextOrder[index - 1] = temp;
                                                            setLayoutConfig({ ...layoutConfig, elementsOrder: nextOrder });
                                                        }}
                                                        className="btn-icon" style={{ width: 22, height: 22, padding: 0, opacity: index === 0 ? 0.3 : 1 }}
                                                    >
                                                        <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
                                                    </button>
                                                    <button
                                                        disabled={index === (layoutConfig.elementsOrder?.length || 3) - 1}
                                                        onClick={() => {
                                                            const nextOrder = [...(layoutConfig.elementsOrder || [])];
                                                            const temp = nextOrder[index];
                                                            nextOrder[index] = nextOrder[index + 1];
                                                            nextOrder[index + 1] = temp;
                                                            setLayoutConfig({ ...layoutConfig, elementsOrder: nextOrder });
                                                        }}
                                                        className="btn-icon" style={{ width: 22, height: 22, padding: 0, opacity: index === ((layoutConfig.elementsOrder?.length || 3) - 1) ? 0.3 : 1 }}
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Mova os itens para definir a prioridade visual.
                                    </p>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Layout (Grade e Margens)</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Colunas</label><input type="number" className="form-input" value={layoutConfig.columns} onChange={e => setLayoutConfig({ ...layoutConfig, columns: Number(e.target.value) })} /></div>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Linhas</label><input type="number" className="form-input" value={layoutConfig.rows} onChange={e => setLayoutConfig({ ...layoutConfig, rows: Number(e.target.value) })} /></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Topo</label><input type="number" className="form-input" value={layoutConfig.marginTop} onChange={e => setLayoutConfig({ ...layoutConfig, marginTop: Number(e.target.value) })} /></div>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Base</label><input type="number" className="form-input" value={layoutConfig.marginBottom} onChange={e => setLayoutConfig({ ...layoutConfig, marginBottom: Number(e.target.value) })} /></div>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Esq</label><input type="number" className="form-input" value={layoutConfig.marginLeft} onChange={e => setLayoutConfig({ ...layoutConfig, marginLeft: Number(e.target.value) })} /></div>
                                        <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Dir</label><input type="number" className="form-input" value={layoutConfig.marginRight} onChange={e => setLayoutConfig({ ...layoutConfig, marginRight: Number(e.target.value) })} /></div>
                                    </div>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Espaçamentos (Card)</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Gap Grade (px)</label><input type="number" className="form-input" value={layoutConfig.gap} onChange={e => setLayoutConfig({ ...layoutConfig, gap: Number(e.target.value) })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Abaixo Foto (px)</label><input type="number" className="form-input" value={layoutConfig.spacingBelowPhoto} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowPhoto: Number(e.target.value) })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Abaixo Descrição (px)</label><input type="number" className="form-input" value={layoutConfig.spacingBelowDescription} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowDescription: Number(e.target.value) })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Acima Preço (px)</label><input type="number" className="form-input" value={layoutConfig.spacingAbovePrice} onChange={e => setLayoutConfig({ ...layoutConfig, spacingAbovePrice: Number(e.target.value) })} /></div>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Ajustes da Foto</summary>
                                <div style={{ padding: '1rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Escala (%): {Math.round(layoutConfig.photoScale * 100)}</label>
                                    <input type="range" min="0.1" max="1.5" step="0.05" value={layoutConfig.photoScale} onChange={e => setLayoutConfig({ ...layoutConfig, photoScale: Number(e.target.value) })} style={{ width: '100%' }} />
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Ajustes do Preço</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>Selo Visível</label><input type="checkbox" checked={layoutConfig.showPriceSeal} onChange={e => setLayoutConfig({ ...layoutConfig, showPriceSeal: e.target.checked })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Tam. Fonte Preço (rem)</label><input type="number" step="0.1" className="form-input" value={layoutConfig.fontSizePrice} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizePrice: Number(e.target.value) })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Tam. Fonte Descrição (rem)</label><input type="number" step="0.1" className="form-input" value={layoutConfig.fontSizeDescription} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeDescription: Number(e.target.value) })} /></div>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Ajustes dos Códigos</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>Cód. Interno</label><input type="checkbox" checked={layoutConfig.showInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, showInternalCode: e.target.checked })} /></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>EAN</label><input type="checkbox" checked={layoutConfig.showEan} onChange={e => setLayoutConfig({ ...layoutConfig, showEan: e.target.checked })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Fonte Cód. (rem)</label><input type="number" step="0.1" className="form-input" value={layoutConfig.fontInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, fontInternalCode: Number(e.target.value) })} /></div>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Fundo do Card</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Modo</label><select className="form-input" value={layoutConfig.cardBackgroundMode} onChange={e => setLayoutConfig({ ...layoutConfig, cardBackgroundMode: e.target.value })}><option value="none">Nenhum</option><option value="white">Branco</option><option value="gradient">Gradiente</option><option value="glass">Glass</option></select></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Opacidade: {layoutConfig.cardOpacity}</label><input type="range" min="0" max="1" step="0.1" value={layoutConfig.cardOpacity} onChange={e => setLayoutConfig({ ...layoutConfig, cardOpacity: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Radius</label><input type="number" className="form-input" value={layoutConfig.cardRadius} onChange={e => setLayoutConfig({ ...layoutConfig, cardRadius: Number(e.target.value) })} /></div>
                                    <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Padding</label><input type="number" className="form-input" value={layoutConfig.cardPadding} onChange={e => setLayoutConfig({ ...layoutConfig, cardPadding: Number(e.target.value) })} /></div>
                                </div>
                            </details>

                            <details className="settings-group">
                                <summary style={{ fontWeight: 600, padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>Camadas (Globais)</summary>
                                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                        <h5 style={{ marginBottom: '0.5rem' }}>Logo</h5>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>Visível</label><input type="checkbox" checked={layoutConfig.logoConfig.visible} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig, visible: e.target.checked } })} /></div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '5px' }}>
                                            <input type="number" className="form-input" placeholder="X" value={layoutConfig.logoConfig.x} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig, x: Number(e.target.value) } })} />
                                            <input type="number" className="form-input" placeholder="Y" value={layoutConfig.logoConfig.y} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig, y: Number(e.target.value) } })} />
                                        </div>
                                    </div>
                                    <div>
                                        <h5 style={{ marginBottom: '0.5rem' }}>Texto Lateral</h5>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><label>Visível</label><input type="checkbox" checked={layoutConfig.sideTextConfig.visible} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, visible: e.target.checked } })} /></div>
                                        <input type="text" className="form-input" style={{ marginTop: '5px' }} value={layoutConfig.sideTextConfig.text} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, text: e.target.value } })} />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '5px' }}>
                                            <input type="number" className="form-input" placeholder="Rot" value={layoutConfig.sideTextConfig.rotation} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, rotation: Number(e.target.value) } })} />
                                            <input type="number" className="form-input" placeholder="Tam" value={layoutConfig.sideTextConfig.fontSize} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, fontSize: Number(e.target.value) } })} />
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div style={{ padding: '2rem', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '12px' }}>
                        <div style={{ position: 'relative', width: '500px', height: '707px', background: 'white', overflow: 'hidden' }}>
                            {activeThemeForSettings?.backgroundEncartes && <img src={activeThemeForSettings.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} />}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: `${(layoutConfig.marginTop / 10)}%`, paddingBottom: `${(layoutConfig.marginBottom / 10)}%`, paddingLeft: `${(layoutConfig.marginLeft / 10)}%`, paddingRight: `${(layoutConfig.marginRight / 10)}%` }}>
                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${layoutConfig.columns}, 1fr)`, gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`, gap: `${layoutConfig.gap / 4}px`, width: '100%', height: '100%' }}>
                                    {Array.from({ length: layoutConfig.columns * layoutConfig.rows }).map((_, i) => {
                                        const p = mockProducts[i % mockProducts.length];
                                        return (
                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${layoutConfig.cardPadding / 2}px`, background: layoutConfig.cardBackgroundMode === 'white' ? `rgba(255,255,255,${layoutConfig.cardOpacity})` : layoutConfig.cardBackgroundMode === 'gradient' ? `linear-gradient(transparent, rgba(255,255,255,${layoutConfig.cardOpacity}))` : 'transparent', borderRadius: `${layoutConfig.cardRadius}px` }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginBottom: `${layoutConfig.spacingBelowPhoto / 2}px` }}>
                                                    <img src={p.imageUrl} style={{ maxWidth: '80%', maxHeight: '100%', transform: `scale(${layoutConfig.photoScale})` }} />
                                                </div>

                                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    {layoutConfig.elementsOrder.map(element => {
                                                        if (element === 'code' && layoutConfig.showInternalCode) {
                                                            return (
                                                                <div key="code" style={{ color: layoutConfig.colorInternalCode, fontSize: `${layoutConfig.fontInternalCode * 6}px`, fontWeight: 500, marginBottom: '2px' }}>
                                                                    Cód: {p.code}
                                                                </div>
                                                            );
                                                        }
                                                        if (element === 'description') {
                                                            return (
                                                                <div key="desc" style={{ color: layoutConfig.colorDescription, fontSize: `${layoutConfig.fontSizeDescription * 8}px`, fontWeight: 700, textAlign: 'center', marginBottom: `${layoutConfig.spacingBelowDescription / 2}px` }}>
                                                                    {p.description}
                                                                </div>
                                                            );
                                                        }
                                                        if (element === 'price' && p.price) {
                                                            return (
                                                                <div key="price" style={{ color: layoutConfig.colorPrice, fontWeight: 900, fontSize: `${layoutConfig.fontSizePrice * 15}px`, marginTop: `${layoutConfig.spacingAbovePrice / 2}px` }}>
                                                                    R$ {p.price}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {layoutConfig.logoConfig.visible && <div style={{ position: 'absolute', left: `${layoutConfig.logoConfig.x}%`, top: `${layoutConfig.logoConfig.y}%`, transform: `translate(-50%, -50%) scale(${layoutConfig.logoConfig.scale})` }}><img src="https://i.imgur.com/wxbwuwF.png" style={{ width: '80px' }} /></div>}
                            {layoutConfig.sideTextConfig.visible && <div style={{ position: 'absolute', left: `${layoutConfig.sideTextConfig.x}%`, top: `${layoutConfig.sideTextConfig.y}%`, transform: `rotate(${layoutConfig.sideTextConfig.rotation}deg)`, fontSize: '8px', color: layoutConfig.sideTextConfig.color }}>{layoutConfig.sideTextConfig.text}</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'form') {
        return (
            <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => setView('list')} className="btn-icon"><ArrowLeft /></button>
                    <h1 className="title">{editingTheme ? 'Editar Tema' : 'Novo Tema'}</h1>
                </div>
                <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <div><label className="form-label">Nome</label><input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div><label className="form-label">Tag</label><input className="form-input" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label className="form-label">Fundo Encarte (URL)</label>
                                <input className="form-input" placeholder="https://..." value={formData.backgroundEncartes} onChange={e => setFormData({ ...formData, backgroundEncartes: e.target.value })} />
                            </div>
                            <div>
                                <label className="form-label">Url da Capa (URL)</label>
                                <input className="form-input" placeholder="https://..." value={formData.coverUrl} onChange={e => setFormData({ ...formData, coverUrl: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                            <div>
                                <label className="form-label" style={{ marginBottom: '1rem' }}>Módulos Disponíveis</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {[
                                        { id: 'encartes', label: 'Encartes' },
                                        { id: 'catalogo', label: 'Catálogo' }
                                    ].map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => {
                                                const next = formData.availability.includes(t.id)
                                                    ? formData.availability.filter(x => x !== t.id)
                                                    : [...formData.availability, t.id];
                                                setFormData({ ...formData, availability: next });
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: `2px solid ${formData.availability.includes(t.id) ? 'var(--primary-color)' : '#e2e8f0'}`,
                                                background: formData.availability.includes(t.id) ? '#eff6ff' : 'white',
                                                color: formData.availability.includes(t.id) ? 'var(--primary-color)' : '#64748b',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s',
                                                boxShadow: formData.availability.includes(t.id) ? '0 4px 12px rgba(37, 99, 235, 0.1)' : 'none'
                                            }}
                                        >
                                            {t.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Status do Tema</label>
                                <div
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        background: formData.isActive ? '#f0fdf4' : '#fef2f2',
                                        padding: '10px 16px',
                                        borderRadius: '10px',
                                        border: `1px solid ${formData.isActive ? '#bbf7d0' : '#fecaca'}`,
                                        cursor: 'pointer',
                                        width: 'fit-content'
                                    }}
                                >
                                    <div style={{
                                        width: '40px',
                                        height: '20px',
                                        background: formData.isActive ? '#22c55e' : '#cbd5e1',
                                        borderRadius: '20px',
                                        position: 'relative',
                                        transition: 'all 0.3s'
                                    }}>
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            position: 'absolute',
                                            top: '2px',
                                            left: formData.isActive ? '22px' : '2px',
                                            transition: 'all 0.3s'
                                        }} />
                                    </div>
                                    <span style={{
                                        fontWeight: 600,
                                        color: formData.isActive ? '#166534' : '#991b1b',
                                        fontSize: '0.9rem'
                                    }}>
                                        {formData.isActive ? 'Ativado' : 'Desativado'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {userData?.isSystemAdmin ? (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f0f9ff', padding: '10px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                    <input type="checkbox" checked={formData.isPublic} onChange={e => setFormData({ ...formData, isPublic: e.target.checked })} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#0369a1', fontSize: '0.9rem' }}>Tema Público (MASTER)</div>
                                        <div style={{ fontSize: '0.8rem', color: '#0ea5e9' }}>Disponibiliza este tema para todas as empresas da rede.</div>
                                    </div>
                                </div>

                                {!formData.isPublic && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <label className="form-label">Permitir acesso para empresas específicas:</label>
                                        <div style={{
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            background: '#f8fafc',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px'
                                        }}>
                                            {allCompanies.map(c => (
                                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.allowedCompanies.includes(c.id)}
                                                        onChange={e => {
                                                            const next = e.target.checked
                                                                ? [...formData.allowedCompanies, c.id]
                                                                : formData.allowedCompanies.filter(id => id !== c.id);
                                                            setFormData({ ...formData, allowedCompanies: next });
                                                        }}
                                                    />
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                <input type="checkbox" checked={formData.isPublic} onChange={e => setFormData({ ...formData, isPublic: e.target.checked })} />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.9rem' }}>Solicitar Publicação Global</div>
                                    <div style={{ fontSize: '0.8rem', color: '#b45309' }}>Seu tema será enviado para análise e, se aprovado, ficará disponível para todos.</div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button className="btn-secondary" onClick={() => setView('list')}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveTheme}>Salvar</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 className="title">Gerenciamento de Temas</h1>
                <button className="btn btn-primary" onClick={handleCreate}><Plus size={18} /> Novo Tema</button>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
                {['all', 'pending', 'global'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t as any)} style={{ padding: '10px 0', border: 'none', background: 'none', borderBottom: activeTab === t ? '2px solid var(--primary-color)' : 'none', color: activeTab === t ? 'var(--primary-color)' : '#666', cursor: 'pointer' }}>{t.toUpperCase()}</button>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {filteredThemes.map(t => (
                    <div key={t.id} className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ height: '140px', background: '#f5f5f5', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #eee' }}>
                            {(t.backgroundEncartes || t.coverUrl) && <img src={t.coverUrl || t.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <h3 style={{ marginBottom: '1rem' }}>{t.name}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    display: 'flex',
                                    gap: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    {t.availability.map(v => (
                                        <span key={v} style={{ color: 'var(--primary-color)', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{v}</span>
                                    ))}
                                </div>
                                {t.isActive === false && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>[OFF]</span>}
                                {t.isPublic && <Globe size={14} color="var(--primary-color)" title="Global (Master)" />}
                                {t.status === 'pending' && <AlertCircle size={14} color="#f59e0b" title="Aguardando Aprovação" />}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {userData?.isSystemAdmin && t.status === 'pending' && (
                                    <>
                                        <button className="btn-icon" style={{ color: 'green', border: '1px solid green' }} onClick={() => handleApproveTheme(t)} title="Aprovar Publicação Global"><Check size={16} /></button>
                                        <button className="btn-icon" style={{ color: 'red', border: '1px solid red' }} onClick={() => handleRejectTheme(t)} title="Rejeitar"><X size={16} /></button>
                                    </>
                                )}
                                {(userData?.isSystemAdmin || (!t.isPublic && t.status !== 'pending') || (t.companyId === userData?.companyId)) && (
                                    <>
                                        <button className="btn-icon" onClick={() => openSettings(t)} title="Configurar Layout"><Settings size={16} /></button>
                                        <button className="btn-icon" onClick={() => openEdit(t)} title="Editar"><Edit size={16} /></button>
                                        <button className="btn-icon" style={{ color: 'red' }} onClick={() => handleDelete(t)} title="Excluir"><Trash2 size={16} /></button>
                                    </>
                                )}
                                {(!userData?.isSystemAdmin && t.isPublic) && (
                                    <button className="btn-icon" onClick={() => handleDuplicate(t)} title="Duplicar para Minha Empresa"><Copy size={16} /></button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ThemesModule;
