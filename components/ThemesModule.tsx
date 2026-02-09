
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { collection, query, getDocs, doc, setDoc, deleteDoc, where, orderBy, addDoc, limit, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Search, Plus, Edit, Trash2, Image as ImageIcon, Check, X, Globe, Lock, ArrowLeft, Copy, Building2, AlertCircle, Settings, Layout, Type, Grid, ChevronDown, FileEdit, Layers, RefreshCw } from 'lucide-react';
import { DEFAULT_LAYOUT_CONFIG } from '../constants';
import { GRID_FORMATS, GridFormatKey } from './FlyerTypes';
import { GRID_CONFIG_DEFAULTS } from './GridDefaults';

interface Theme {
    id: string;
    name: string;
    categories: string[]; // Nova: categorias do negócio
    subcategories: string[]; // Nova: subcategorias do negócio
    backgroundEncartes: string;
    coverUrl?: string;
    isActive: boolean;
    availability: string[]; // 'encartes', 'catalogo'
    isPublic: boolean;
    companyId: string;
    allowedCompanies?: string[]; // Companies that can see this theme (if not public)
    status: 'active' | 'pending' | 'archived' | 'draft'; // Novo: draft para temas globais não configurados
    createdAt: any;
    defaultLayoutConfig?: any; // Legacy: Stores the saved layout configuration
    gridConfigs?: {
        [key in GridFormatKey]?: {
            layoutConfig: any;
            isConfigured: boolean;
        };
    };
    defaultPromoMonth?: string;
    defaultPromoBadge?: string;
    isConfigured?: boolean; // True if ALL grid formats are configured
    configuredFormats?: GridFormatKey[]; // List of configured formats
    inheritedFromCompany?: string; // Nova: se herda categoria da empresa
}

const ThemesModule = () => {
    const { userData } = useAuth();
    const navigate = useNavigate();
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'global' | 'drafts'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'list' | 'form'>('list');
    const [allCompanies, setAllCompanies] = useState<any[]>([]);

    const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
    const [dbCategories, setDbCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchBaseData = async () => {
            const catSnap = await getDocs(collection(db, 'business_categories'));
            setDbCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchBaseData();
    }, []);

    useEffect(() => {
        if (userData) {
            fetchThemes();
            if (userData.isSystemAdmin) {
                fetchCompanies();
            }
        }
    }, [userData?.uid, userData?.companyId, activeTab]);

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
                const q = query(themesRef, where('isPublic', '==', true), where('status', '==', 'active'));
                const snapshot = await getDocs(q);
                setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
            } else if (activeTab === 'pending') {
                const q = query(themesRef, where('status', '==', 'pending'));
                const snapshot = await getDocs(q);
                setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
            } else if (activeTab === 'drafts') {
                // Rascunhos: temas globais criados mas ainda não publicados
                const q = query(themesRef, where('status', '==', 'draft'));
                const snapshot = await getDocs(q);
                setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
            } else {
                if (userData?.isSystemAdmin) {
                    const snapshot = await getDocs(themesRef);
                    setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme)));
                } else {
                    // Usuários comuns não veem temas draft
                    const publicQ = query(themesRef, where('isPublic', '==', true), where('status', '==', 'active'));
                    const myQ = userData?.companyId ? query(themesRef, where('companyId', '==', userData.companyId)) : null;
                    const allowedQ = userData?.companyId ? query(themesRef, where('allowedCompanies', 'array-contains', userData.companyId)) : null;

                    const promises = [getDocs(publicQ)];
                    if (myQ) promises.push(getDocs(myQ));
                    if (allowedQ) promises.push(getDocs(allowedQ));

                    const snapshots = await Promise.all(promises);
                    const merged = new Map();
                    snapshots.forEach(snap => {
                        snap.docs.forEach(d => {
                            const data = d.data();
                            // Filtrar temas em draft (não devem aparecer para usuários comuns)
                            if (data.status !== 'draft') {
                                merged.set(d.id, { id: d.id, ...data as any });
                            }
                        });
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

    const handleMigrateAllThemes = async () => {
        if (!userData?.isSystemAdmin) return;
        if (!confirm("⚠️ MUDANÇA CRÍTICA: Deseja aplicar os NOVOS PADRÕES OFICIAIS (1x1, 2x2, 3x2, 3x3, 4x4) em TODOS os temas existentes?\n\nIsso removerá os selos de oferta/mês e ajustará margens, gaps e fontes de todos os temas globais e de empresas.\n\nESTA AÇÃO NÃO PODE SER DESFEITA.")) return;

        setLoading(true);
        try {
            const themesRef = collection(db, 'themes');
            const snapshot = await getDocs(themesRef);

            let count = 0;
            const batchSize = 100; // Firestore batch limit is small but let's do simple updates or multiple batches if needed
            // For simplicity in a script, we can loop and update since we are in a dev/admin tool

            for (const themeDoc of snapshot.docs) {
                const themeId = themeDoc.id;
                const themeData = themeDoc.data();

                const updatedGridConfigs: any = {};
                GRID_FORMATS.forEach(f => {
                    // Mergear o layoutConfig atual (se existir) com os novos defaults
                    // Priorizamos os NOVOS DEFAULTS para garantir que as margens e selos mudem
                    const currentConfig = themeData.gridConfigs?.[f.key]?.layoutConfig || {};

                    updatedGridConfigs[f.key] = {
                        layoutConfig: {
                            ...DEFAULT_LAYOUT_CONFIG, // Base
                            ...currentConfig,        // O que o usuário tinha (cores, background?)
                            ...(GRID_CONFIG_DEFAULTS[f.key] || {}), // Oficial (Sobrescreve com as novas medidas e remove selos)
                            columns: f.columns,
                            rows: f.rows,
                            // Manter cores se já existiam
                            colorDescription: currentConfig.colorDescription || themeData.defaultLayoutConfig?.colorDescription || DEFAULT_LAYOUT_CONFIG.colorDescription,
                            colorPrice: currentConfig.colorPrice || themeData.defaultLayoutConfig?.colorPrice || DEFAULT_LAYOUT_CONFIG.colorPrice,
                            colorInternalCode: currentConfig.colorInternalCode || themeData.defaultLayoutConfig?.colorInternalCode || DEFAULT_LAYOUT_CONFIG.colorInternalCode,
                            colorEan: currentConfig.colorEan || themeData.defaultLayoutConfig?.colorEan || DEFAULT_LAYOUT_CONFIG.colorEan,
                        },
                        isConfigured: true
                    };
                });

                await setDoc(doc(db, 'themes', themeId), {
                    gridConfigs: updatedGridConfigs,
                    configuredFormats: GRID_FORMATS.map(f => f.key),
                    isConfigured: true,
                    updatedAt: new Date()
                }, { merge: true });
                count++;
            }

            alert(`✅ Sucesso! ${count} temas foram migrados para o novo padrão oficial.`);
            fetchThemes();
        } catch (error) {
            console.error(error);
            alert("Erro ao processar migração.");
        } finally {
            setLoading(false);
        }
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '', categories: [] as string[], subcategories: [] as string[],
        backgroundEncartes: '', coverUrl: '', isActive: true, availability: [] as string[],
        isPublic: false, allowedCompanies: [] as string[],
        defaultPromoMonth: '', defaultPromoBadge: '', inheritedFromCompany: ''
    });

    const resetForm = () => {
        setFormData({
            name: '', categories: [], subcategories: [],
            backgroundEncartes: '', coverUrl: '', isActive: true, availability: [],
            isPublic: false, allowedCompanies: [],
            defaultPromoMonth: '', defaultPromoBadge: '', inheritedFromCompany: ''
        });
        setEditingTheme(null);
    };

    const handleSaveTheme = async () => {
        try {
            const themeId = editingTheme ? editingTheme.id : `theme_${Date.now()}`;

            // Lógica de Status e Publicidade
            // NOVO: Temas globais criados pelo SuperAdmin começam como RASCUNHO (draft)
            let finalIsPublic = false;
            let finalStatus: 'active' | 'pending' | 'archived' | 'draft' = 'active';

            if (userData?.isSystemAdmin) {
                finalIsPublic = formData.isPublic;
                // Se é um novo tema global, começa como RASCUNHO
                if (!editingTheme && formData.isPublic) {
                    finalStatus = 'draft';
                    finalIsPublic = false; // Não fica público até aprovar
                } else {
                    finalStatus = 'active';
                }
            } else {
                if (formData.isPublic) {
                    finalStatus = 'pending';
                    finalIsPublic = false;
                } else {
                    finalStatus = 'active';
                    finalIsPublic = false;
                }
            }

            // Herda categorias da empresa se for tema específico
            let finalCategories = formData.categories;
            let finalSubcategories = formData.subcategories;
            if (!formData.isPublic && formData.inheritedFromCompany) {
                const company = allCompanies.find(c => c.id === formData.inheritedFromCompany);
                if (company?.category) finalCategories = [company.category];
                if (company?.subcategory) finalSubcategories = [company.subcategory];
            }

            const themeData: any = {
                name: formData.name,
                categories: finalCategories,
                subcategories: finalSubcategories,
                backgroundEncartes: formData.backgroundEncartes,
                coverUrl: formData.coverUrl,
                isActive: formData.isActive,
                availability: formData.availability,
                isPublic: finalIsPublic,
                status: finalStatus,
                allowedCompanies: formData.allowedCompanies,
                defaultPromoMonth: formData.defaultPromoMonth,
                defaultPromoBadge: formData.defaultPromoBadge,
                isConfigured: editingTheme ? (editingTheme.isConfigured ?? true) : !formData.isPublic,
                inheritedFromCompany: formData.inheritedFromCompany || null,
                updatedAt: new Date()
            };

            if (!editingTheme) {
                themeData.createdAt = new Date();
                themeData.companyId = userData?.companyId;

                // NOVO: Inicializar com os 5 formatos padrão oficiais
                themeData.gridConfigs = {};
                GRID_FORMATS.forEach(f => {
                    themeData.gridConfigs[f.key] = {
                        layoutConfig: {
                            ...DEFAULT_LAYOUT_CONFIG,
                            ...(GRID_CONFIG_DEFAULTS[f.key] || {}),
                            columns: f.columns,
                            rows: f.rows
                        },
                        isConfigured: true
                    };
                });
                themeData.configuredFormats = GRID_FORMATS.map(f => f.key);
                themeData.isConfigured = true;
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
            await setDoc(doc(db, 'themes', theme.id), { status: 'active', isPublic: true, isConfigured: false, updatedAt: new Date() }, { merge: true });
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

    // Publicar tema rascunho
    const handlePublishDraft = async (theme: Theme) => {
        if (!userData?.isSystemAdmin) return;
        if (theme.status !== 'draft') return;

        // Verificar se TODOS os 5 formatos estão configurados
        const configuredCount = theme.configuredFormats?.length || 0;
        const totalFormats = GRID_FORMATS.length; // 5

        if (configuredCount < totalFormats) {
            alert(`O tema "${theme.name}" ainda não tem todos os formatos configurados.\n\nConfigurados: ${configuredCount}/${totalFormats}\n\nPor favor, configure todos os formatos (1x1, 2x2, 3x2, 3x3, 4x4) antes de publicar.`);
            return;
        }

        if (!confirm(`Deseja publicar o tema "${theme.name}"? Ele ficará disponível para todas as empresas com todos os ${totalFormats} formatos configurados.`)) {
            return;
        }

        try {
            await setDoc(doc(db, 'themes', theme.id), {
                status: 'active',
                isPublic: true,
                isConfigured: true,
                updatedAt: new Date()
            }, { merge: true });
            alert('Tema publicado com sucesso! Agora está disponível para todos.');
            fetchThemes();
        } catch (error) {
            console.error(error);
            alert('Erro ao publicar tema.');
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
            name: theme.name,
            categories: theme.categories || [],
            subcategories: theme.subcategories || [],
            backgroundEncartes: theme.backgroundEncartes,
            coverUrl: theme.coverUrl || '',
            isActive: theme.isActive !== undefined ? theme.isActive : true,
            availability: theme.availability,
            isPublic: theme.isPublic,
            allowedCompanies: theme.allowedCompanies || [],
            defaultPromoMonth: theme.defaultPromoMonth || '',
            defaultPromoBadge: theme.defaultPromoBadge || '',
            inheritedFromCompany: theme.inheritedFromCompany || ''
        });
        setView('form');
    };

    // State para modal de seleção de formato
    const [showFormatModal, setShowFormatModal] = useState(false);
    const [formatModalTheme, setFormatModalTheme] = useState<Theme | null>(null);

    const openSettings = (theme: Theme) => {
        // Para temas em draft, mostrar modal de seleção de formato
        if (theme.status === 'draft' && userData?.isSystemAdmin) {
            setFormatModalTheme(theme);
            setShowFormatModal(true);
        } else {
            // Para outros temas, ir direto para configuração (comportamento antigo)
            navigate(`/admin/encartes?themeId=${theme.id}`);
        }
    };

    const handleSelectFormat = (formatKey: GridFormatKey) => {
        if (!formatModalTheme) return;
        // Navega para encartes passando tema E formato específico
        navigate(`/admin/encartes?themeId=${formatModalTheme.id}&gridFormat=${formatKey}`);
        setShowFormatModal(false);
        setFormatModalTheme(null);
    };

    const handleCreate = () => { resetForm(); setView('form'); }

    const handleDuplicate = async (theme: Theme) => {
        if (!userData?.companyId) return;
        if (!confirm(`Deseja duplicar o tema "${theme.name}"?`)) return;

        try {
            const newThemeData = {
                name: `${theme.name} (Cópia)`,
                categories: theme.categories || [],
                subcategories: theme.subcategories || [],
                backgroundEncartes: theme.backgroundEncartes || '',
                coverUrl: theme.coverUrl || '',
                isActive: theme.isActive ?? true,
                availability: theme.availability || [],
                companyId: userData.companyId, isPublic: false,
                status: 'active', createdAt: new Date(), updatedAt: new Date(),
                defaultLayoutConfig: theme.defaultLayoutConfig || {},
                isConfigured: true
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
        (t.categories || []).some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.subcategories || []).some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase()))
    );


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
                        <div>
                            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Building2 size={16} /> Categorias do Tema
                            </label>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                {formData.isPublic ? 'Para temas globais, selecione uma ou mais categorias de negócio.' : 'Para temas específicos, a categoria pode ser herdada da empresa.'}
                            </p>

                            {/* Categorias Selecionadas */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                {formData.categories.map(cat => (
                                    <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {cat}
                                        <X size={14} style={{ cursor: 'pointer' }} onClick={() => setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat) })} />
                                    </span>
                                ))}
                            </div>

                            {/* Seleção de Categorias */}
                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {dbCategories.map(cat => {
                                        const isSelected = formData.categories.includes(cat.name);
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat.name) });
                                                    } else {
                                                        setFormData({ ...formData, categories: [...formData.categories, cat.name] });
                                                    }
                                                }}
                                                style={{
                                                    background: isSelected ? 'var(--primary-color)' : 'white',
                                                    color: isSelected ? 'white' : '#64748b',
                                                    border: `1px solid ${isSelected ? 'var(--primary-color)' : '#e2e8f0'}`,
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {isSelected ? '✓ ' : ''}{cat.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subcategorias Selecionadas */}
                            <label className="form-label" style={{ fontWeight: 600, marginTop: '8px' }}>Subcategorias (opcional)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                {formData.subcategories.map(sub => (
                                    <span key={sub} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {sub}
                                        <X size={14} style={{ cursor: 'pointer' }} onClick={() => setFormData({ ...formData, subcategories: formData.subcategories.filter(s => s !== sub) })} />
                                    </span>
                                ))}
                            </div>

                            {/* Seleção de Subcategorias baseada nas categorias selecionadas */}
                            {formData.categories.length > 0 && (
                                <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', border: '1px solid #dbeafe' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {dbCategories
                                            .filter(cat => formData.categories.includes(cat.name))
                                            .flatMap(c => c.subcategories || [])
                                            .filter((sub, i, arr) => arr.indexOf(sub) === i) // Remove duplicates
                                            .map(sub => {
                                                const isSelected = formData.subcategories.includes(sub);
                                                return (
                                                    <button
                                                        key={sub}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setFormData({ ...formData, subcategories: formData.subcategories.filter(s => s !== sub) });
                                                            } else {
                                                                setFormData({ ...formData, subcategories: [...formData.subcategories, sub] });
                                                            }
                                                        }}
                                                        style={{
                                                            background: isSelected ? '#2563eb' : 'white',
                                                            color: isSelected ? 'white' : '#2563eb',
                                                            border: `1px solid ${isSelected ? '#2563eb' : '#dbeafe'}`,
                                                            padding: '4px 10px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            fontWeight: isSelected ? 600 : 400
                                                        }}
                                                    >
                                                        {isSelected ? '✓ ' : ''}{sub}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label className="form-label">Mês Padrão (Opcional)</label>
                                <input className="form-input" placeholder="Ex: Mês de Janeiro" value={formData.defaultPromoMonth} onChange={e => setFormData({ ...formData, defaultPromoMonth: e.target.value })} />
                            </div>
                            <div>
                                <label className="form-label">Dia/Selo Padrão (Opcional)</label>
                                <input className="form-input" placeholder="Ex: Terça da Carne" value={formData.defaultPromoBadge} onChange={e => setFormData({ ...formData, defaultPromoBadge: e.target.value })} />
                            </div>
                        </div>

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
            {/* Modal de Seleção de Formato */}
            {showFormatModal && formatModalTheme && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '95%',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                background: '#eff6ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem'
                            }}>
                                <Grid size={28} color="var(--primary-color)" />
                            </div>
                            <h2 style={{ margin: 0, color: '#1f2937' }}>Configurar Formato</h2>
                            <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                Selecione o formato que deseja configurar para o tema <strong>"{formatModalTheme.name}"</strong>
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
                            {GRID_FORMATS.map(format => {
                                const isConfigured = formatModalTheme.configuredFormats?.includes(format.key);
                                return (
                                    <button
                                        key={format.key}
                                        onClick={() => handleSelectFormat(format.key)}
                                        style={{
                                            padding: '12px 8px',
                                            borderRadius: '12px',
                                            border: isConfigured ? '2px solid #10b981' : '2px solid #e5e7eb',
                                            background: isConfigured ? '#ecfdf5' : 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            position: 'relative'
                                        }}
                                    >
                                        {isConfigured && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-6px',
                                                right: '-6px',
                                                background: '#10b981',
                                                borderRadius: '50%',
                                                width: '18px',
                                                height: '18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Check size={12} color="white" />
                                            </div>
                                        )}
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: isConfigured ? '#059669' : '#1f2937' }}>
                                            {format.label}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px' }}>
                                            {format.items} itens
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{
                            background: '#fef3c7',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '1.5rem',
                            fontSize: '0.85rem',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertCircle size={18} />
                            <span>Configure todos os 5 formatos antes de publicar o tema.</span>
                        </div>

                        <button
                            onClick={() => { setShowFormatModal(false); setFormatModalTheme(null); }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                color: '#6b7280',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="title" style={{ margin: 0 }}>Gerenciamento de Temas</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {userData?.isSystemAdmin && (
                        <button
                            className="btn"
                            onClick={handleMigrateAllThemes}
                            style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                padding: '8px 16px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                gap: '8px'
                            }}
                        >
                            <RefreshCw size={16} />
                            Migrar TODOS os Temas (Oficial)
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleCreate}><Plus size={18} /> Novo Tema</button>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
                {[
                    { key: 'all', label: 'TODOS' },
                    { key: 'drafts', label: 'RASCUNHOS' },
                    { key: 'pending', label: 'PENDENTES' },
                    { key: 'global', label: 'GLOBAIS' }
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key as any)}
                        style={{
                            padding: '10px 0',
                            border: 'none',
                            background: 'none',
                            borderBottom: activeTab === t.key ? '2px solid var(--primary-color)' : 'none',
                            color: activeTab === t.key ? 'var(--primary-color)' : '#666',
                            cursor: 'pointer',
                            fontWeight: activeTab === t.key ? 600 : 400
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {filteredThemes.map(t => (
                    <div key={t.id} className="glass-card" style={{ padding: '1.25rem', position: 'relative' }}>
                        {/* Badge de Status no canto */}
                        {t.status === 'draft' && (
                            <div style={{
                                position: 'absolute', top: '8px', right: '8px', zIndex: 10,
                                background: '#fbbf24', color: '#1f2937', padding: '4px 12px',
                                borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <FileEdit size={12} /> RASCUNHO
                            </div>
                        )}
                        <div style={{ height: '140px', background: '#f5f5f5', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #eee' }}>
                            {(t.backgroundEncartes || t.coverUrl) && <img src={t.coverUrl || t.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={t.name} />}
                        </div>
                        <h3 style={{ marginBottom: '0.5rem' }}>{t.name}</h3>

                        {/* Categorias */}
                        {(t.categories?.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.5rem' }}>
                                {t.categories.slice(0, 3).map(cat => (
                                    <span key={cat} style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>{cat}</span>
                                ))}
                                {t.categories.length > 3 && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>+{t.categories.length - 3}</span>}
                            </div>
                        )}

                        {/* Grid Formats Configuration Status */}
                        {t.status === 'draft' && userData?.isSystemAdmin && (
                            <div style={{
                                display: 'flex',
                                gap: '4px',
                                marginBottom: '0.75rem',
                                background: '#fef3c7',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #fde68a'
                            }}>
                                <Layers size={14} color="#92400e" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>
                                        Formatos: {(t.configuredFormats?.length || 0)}/5 configurados
                                    </div>
                                    <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                                        {GRID_FORMATS.map(format => {
                                            const isConfigured = t.configuredFormats?.includes(format.key);
                                            return (
                                                <div
                                                    key={format.key}
                                                    style={{
                                                        width: '28px',
                                                        height: '18px',
                                                        borderRadius: '4px',
                                                        background: isConfigured ? '#10b981' : '#e5e7eb',
                                                        color: isConfigured ? 'white' : '#9ca3af',
                                                        fontSize: '0.55rem',
                                                        fontWeight: 700,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    title={`${format.label} - ${isConfigured ? 'Configurado' : 'Pendente'}`}
                                                >
                                                    {format.key}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                {t.isPublic && t.isConfigured === false && t.status !== 'draft' && <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>CONFIGURAR</span>}
                                {t.status === 'pending' && <AlertCircle size={14} color="#f59e0b" title="Aguardando Aprovação" />}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {/* Botão Publicar para temas Draft */}
                                {userData?.isSystemAdmin && t.status === 'draft' && (
                                    <button
                                        className="btn-icon"
                                        style={{
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                        onClick={() => handlePublishDraft(t)}
                                        title="Publicar Tema"
                                    >
                                        <Globe size={14} /> Publicar
                                    </button>
                                )}
                                {userData?.isSystemAdmin && t.status === 'pending' && (
                                    <>
                                        <button className="btn-icon" style={{ color: 'green', border: '1px solid green' }} onClick={() => handleApproveTheme(t)} title="Aprovar Publicação Global"><Check size={16} /></button>
                                        <button className="btn-icon" style={{ color: 'red', border: '1px solid red' }} onClick={() => handleRejectTheme(t)} title="Rejeitar"><X size={16} /></button>
                                    </>
                                )}
                                {(userData?.isSystemAdmin || (!t.isPublic && t.status !== 'pending') || (t.companyId === userData?.companyId)) && (
                                    <>
                                        <button
                                            className="btn-icon"
                                            onClick={() => openSettings(t)}
                                            title="Configurar Layout/Baseline"
                                            style={(t.isPublic && t.isConfigured === false) || t.status === 'draft' ? { background: 'var(--primary-color)', color: 'white' } : {}}
                                        >
                                            <Settings size={16} />
                                        </button>
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
