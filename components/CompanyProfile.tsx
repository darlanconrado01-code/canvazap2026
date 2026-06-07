import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Building2, Save, MapPin, Phone, Globe, Mail, Webhook, Settings, Tag, ChevronRight, Wand2, Image as ImageIcon, Trash2, CheckCircle2, XCircle, Code, Copy, RefreshCw, Barcode } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import WebhookSettings from './WebhookSettings';
import { uploadToR2 } from '../services/r2Service';
import { Loader2, Upload, Plus } from 'lucide-react';

interface BusinessCategory {
    id: string;
    name: string;
    subcategories: string[];
}

const CompanyProfile = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'webhooks' | 'art_guidelines' | 'products' | 'api' | 'image_bank'>('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        logoUrl: '',
        logoVariations: [] as string[],
        phone: '',
        email: '',
        address: '',
        website: '',
        description: '',
        category: '',
        subcategory: '', // NEW: Company subcategory
        color: '#2563eb', // Brand color
        openaiApiKey: '',
        groqApiKey: '',
        geminiApiKey: '',
        apiKey: '', // Internal API Key
        products: [] as { id: string; name: string; imageUrl: string; width?: number; height?: number; depth?: number }[],
        // Art Guidelines
        toneOfVoice: '',
        visualGuidelines: '',
        visualAllowed: '',
        visualForbidden: '',
        referenceImages: [] as string[],
        imageBankSettings: {
            customUrl: '',
            priority: 'global',
            searchByInternalCode: true,
            searchByName: true
        }
    });

    const [dbCategories, setDbCategories] = useState<BusinessCategory[]>([]);

    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                // Fetch dynamic categories
                const catSnap = await getDocs(collection(db, 'business_categories'));
                setDbCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessCategory)));
            } catch (err) {
                console.error("Error fetching business categories:", err);
            }
        };
        fetchBaseData();
    }, []);

    useEffect(() => {
        const fetchCompany = async () => {
            if (userData?.companyId) {
                try {
                    const docSnap = await getDoc(doc(db, 'companies', userData.companyId));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            name: data.name || '',
                            logoUrl: data.logoUrl || '',
                            logoVariations: data.logoVariations || [],
                            phone: data.phone || '',
                            email: data.email || '',
                            address: data.address || '',
                            website: data.website || '',
                            description: data.description || '',
                            category: data.category || '',
                            subcategory: data.subcategory || '',
                            color: data.color || '#2563eb',
                            openaiApiKey: data.openaiApiKey || '',
                            groqApiKey: data.groqApiKey || '',
                            geminiApiKey: data.geminiApiKey || '',
                            apiKey: data.crm?.apiKey || '',
                            products: data.products || [],
                            toneOfVoice: data.artRules?.toneOfVoice || '',
                            visualGuidelines: data.artRules?.visualGuidelines || '',
                            visualAllowed: data.artRules?.visualAllowed || '',
                            visualForbidden: data.artRules?.visualForbidden || '',
                            referenceImages: data.artRules?.referenceImages || [],
                            imageBankSettings: data.imageBankSettings || {
                                customUrl: '',
                                priority: 'global',
                                searchByInternalCode: true,
                                searchByName: true
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error fetching company:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchCompany();
    }, [userData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData?.companyId) return;

        setSaving(true);
        try {
            const { apiKey, ...saveData } = formData;

            const cleanArtRules = {
                toneOfVoice: formData.toneOfVoice || '',
                visualGuidelines: formData.visualGuidelines || '',
                visualAllowed: formData.visualAllowed || '',
                visualForbidden: formData.visualForbidden || '',
                referenceImages: formData.referenceImages || [],
            };

            await updateDoc(doc(db, 'companies', userData.companyId), {
                ...saveData,
                products: formData.products || [],
                artRules: cleanArtRules,
                'artRules.toneOfVoice': cleanArtRules.toneOfVoice,
                'artRules.visualGuidelines': cleanArtRules.visualGuidelines,
                'artRules.visualAllowed': cleanArtRules.visualAllowed,
                'artRules.visualForbidden': cleanArtRules.visualForbidden,
                'artRules.referenceImages': cleanArtRules.referenceImages,
                imageBankSettings: formData.imageBankSettings || {
                    customUrl: '',
                    priority: 'global',
                    searchByInternalCode: true,
                    searchByName: true
                },
                updatedAt: new Date().toISOString()
            });
            alert('Dados da empresa atualizados com sucesso!');
        } catch (error) {
            console.error("Error saving company:", error);
            alert('Erro ao salvar dados.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.companyId) return;

        setUploading(true);
        try {
            const path = `companies/${userData.companyId}/logos`;
            const url = await uploadToR2(file, path);
            setFormData(prev => ({ ...prev, logoUrl: url }));

            // Immediate persistence
            await updateDoc(doc(db, 'companies', userData.companyId), {
                logoUrl: url,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error uploading logo:", error);
            alert("Erro ao fazer upload da logo.");
        } finally {
            setUploading(false);
        }
    };

    const handleVariationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.companyId) return;

        if (formData.logoVariations.length >= 5) {
            alert("Limite máximo de 5 variações atingido.");
            return;
        }

        setUploading(true);
        try {
            const path = `companies/${userData.companyId}/variations`;
            const url = await uploadToR2(file, path);
            const newVariations = [...formData.logoVariations, url];

            setFormData(prev => ({
                ...prev,
                logoVariations: newVariations
            }));

            // Immediate persistence
            await updateDoc(doc(db, 'companies', userData.companyId), {
                logoVariations: newVariations,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error uploading variation:", error);
            alert("Erro ao fazer upload da variação.");
        } finally {
            setUploading(false);
        }
    };

    const removeVariation = async (index: number) => {
        if (!userData?.companyId) return;

        const newVariations = formData.logoVariations.filter((_, i) => i !== index);
        setFormData(prev => ({
            ...prev,
            logoVariations: newVariations
        }));

        try {
            await updateDoc(doc(db, 'companies', userData.companyId), {
                logoVariations: newVariations,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error removing variation:", error);
        }
    };

    const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.companyId) return;

        setUploading(true);
        try {
            const path = `companies/${userData.companyId}/references`;
            const url = await uploadToR2(file, path);
            const newRefs = [...formData.referenceImages, url];

            setFormData(prev => ({ ...prev, referenceImages: newRefs }));

            await updateDoc(doc(db, 'companies', userData.companyId), {
                'artRules.referenceImages': newRefs,
                updatedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error uploading reference:", error);
            alert("Erro ao fazer upload da referência.");
        } finally {
            setUploading(false);
        }
    };

    const removeReferenceImage = async (index: number) => {
        if (!userData?.companyId) return;
        const newRefs = formData.referenceImages.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, referenceImages: newRefs }));
        try {
            await updateDoc(doc(db, 'companies', userData.companyId), {
                'artRules.referenceImages': newRefs,
                updatedAt: new Date().toISOString()
            });
        } catch (error) { console.error(error); }
    };

    const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.companyId) return;

        setUploading(true);
        try {
            const path = `companies/${userData.companyId}/products/${Date.now()}_${file.name}`;
            const url = await uploadToR2(file, path);

            const newProduct = {
                id: Date.now().toString(),
                name: '',
                imageUrl: url,
                width: 0,
                height: 0,
                depth: 0
            };

            const newProducts = [...formData.products, newProduct];
            setFormData(prev => ({ ...prev, products: newProducts }));

            // Immediate persistence
            await updateDoc(doc(db, 'companies', userData.companyId), {
                products: newProducts,
                updatedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error uploading product:", error);
            alert("Erro ao fazer upload do produto.");
        } finally {
            setUploading(false);
        }
    };

    const updateProductName = (index: number, newName: string) => {
        const newProducts = [...formData.products];
        newProducts[index].name = newName;
        setFormData(prev => ({ ...prev, products: newProducts }));
    };

    const removeProduct = async (index: number) => {
        const newProducts = formData.products.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, products: newProducts }));

        if (userData?.companyId) {
            try {
                await updateDoc(doc(db, 'companies', userData.companyId), {
                    products: newProducts,
                    updatedAt: new Date().toISOString()
                });
            } catch (error) { console.error(error); }
        }
    };

    const generateNewApiKey = async () => {
        if (!userData?.companyId) return;
        if (!confirm('Gerar uma nova chave API invalidará a anterior. Deseja continuar?')) return;

        setLoading(true);
        try {
            // Simple random key generation
            const newKey = 'sk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');

            await updateDoc(doc(db, 'companies', userData.companyId), {
                'crm.apiKey': newKey,
                updatedAt: new Date().toISOString()
            });
            setFormData(prev => ({ ...prev, apiKey: newKey }));
            alert('Nova chave API gerada com sucesso!');
        } catch (error) {
            console.error("Error generating API key:", error);
            alert('Erro ao gerar chave API.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copiado para a área de transferência!');
    };

    if (loading) return <div className="p-8">Carregando...</div>;

    return (
        <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Settings size={18} /> Perfil da Empresa
                </button>
                <button
                    onClick={() => setActiveTab('webhooks')}
                    className={`btn ${activeTab === 'webhooks' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Webhook size={18} /> Webhooks
                </button>
                <button
                    onClick={() => setActiveTab('art_guidelines')}
                    className={`btn ${activeTab === 'art_guidelines' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Wand2 size={18} /> Diretrizes de Arte
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <ImageIcon size={18} /> Produtos
                </button>
                <button
                    onClick={() => setActiveTab('api')}
                    className={`btn ${activeTab === 'api' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Code size={18} /> API & Desenvolvedores
                </button>
                <button
                    onClick={() => setActiveTab('image_bank')}
                    className={`btn ${activeTab === 'image_bank' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Barcode size={18} /> Banco de Imagens
                </button>
            </div>

            <div className="glass-card" style={{ padding: '2rem' }}>
                {activeTab === 'profile' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                <Building2 size={32} />
                            </div>
                            <div>
                                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Perfil da Empresa</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Gerencie as informações públicas e internas da sua organização.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                {/* Main Logo */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                                    <div style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', background: '#e2e8f0', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {formData.logoUrl ? (
                                            <img src={formData.logoUrl} alt="Logo Principal" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
                                        ) : (
                                            <Building2 size={32} color="#94a3b8" />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>Logo Principal</label>
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('logo-upload')?.click()}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                        >
                                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            Alterar
                                        </button>
                                        <input id="logo-upload" type="file" hidden onChange={handleLogoUpload} accept="image/*" />
                                    </div>
                                </div>

                                {/* Variations */}
                                <div>
                                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>
                                        Variações (Máx 5)
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {formData.logoVariations.map((url, idx) => (
                                            <div key={idx} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#cbd5e1', padding: '4px' }}>
                                                <img src={url} alt={`Var ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => removeVariation(idx)}
                                                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {formData.logoVariations.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('var-upload')?.click()}
                                                style={{ width: '50px', height: '50px', borderRadius: '8px', border: '2px dashed var(--border-color)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                            >
                                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={20} />}
                                            </button>
                                        )}
                                        <input id="var-upload" type="file" hidden onChange={handleVariationUpload} accept="image/*" />
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                        Adicione variações como logos horizontais, horizontais negativas ou compactas.
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label className="form-label mb-2 block font-semibold">Nome da Empresa</label>
                                    <input
                                        type="text"
                                        className="form-input w-full"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Tag size={16} /> Categoria</label>
                                    <select
                                        className="form-input w-full"
                                        required
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                                    >
                                        <option value="">Selecione uma categoria...</option>
                                        {dbCategories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.category && (
                                    <div>
                                        <label className="form-label mb-2 block font-semibold flex items-center gap-2"><ChevronRight size={16} /> Subcategoria</label>
                                        <select
                                            className="form-input w-full"
                                            value={formData.subcategory}
                                            onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                                        >
                                            <option value="">Selecione uma subcategoria...</option>
                                            {dbCategories.find(c => c.name === formData.category)?.subcategories.map(sub => (
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="form-label mb-2 block font-semibold flex items-center gap-2"><div style={{ width: 20, height: 20, borderRadius: 4, background: formData.color }}></div> Cor da Marca</label>
                                    <input
                                        type="color"
                                        className="form-input w-full h-[42px] p-1"
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Phone size={16} /> Telefone / WhatsApp</label>
                                    <input
                                        type="text"
                                        className="form-input w-full"
                                        placeholder="(00) 00000-0000"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Mail size={16} /> Email de Contato</label>
                                    <input
                                        type="email"
                                        className="form-input w-full"
                                        placeholder="contato@empresa.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="form-label mb-2 block font-semibold flex items-center gap-2"><MapPin size={16} /> Endereço Completo</label>
                                <input
                                    type="text"
                                    className="form-input w-full"
                                    placeholder="Rua, Número, Bairro, Cidade - UF"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Globe size={16} /> Site</label>
                                <input
                                    type="text"
                                    className="form-input w-full"
                                    placeholder="https://www.suaempresa.com.br"
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="form-label mb-2 block font-semibold">Descrição</label>
                                <textarea
                                    className="form-input w-full"
                                    rows={3}
                                    placeholder="Breve descrição sobre a empresa..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Globe size={18} color="var(--primary-color)" /> Integrações & IA
                                </h3>
                                
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Chave API OpenAI</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="password"
                                            className="form-input w-full"
                                            placeholder="sk-..."
                                            value={formData.openaiApiKey}
                                            onChange={e => setFormData({ ...formData, openaiApiKey: e.target.value })}
                                            style={{ paddingRight: '2.5rem' }}
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '11px', opacity: 0.5 }}>
                                            <Globe size={16} />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                        Esta chave será usada para análise de conteúdo e geração de legendas automáticas para sua empresa.
                                    </p>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>Chave API Groq</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="password"
                                            className="form-input w-full"
                                            placeholder="gsk_..."
                                            value={formData.groqApiKey}
                                            onChange={e => setFormData({ ...formData, groqApiKey: e.target.value })}
                                            style={{ paddingRight: '2.5rem' }}
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '11px', opacity: 0.5 }}>
                                            <Globe size={16} />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                        Esta chave será usada para o serviço de transcrição de áudio do CanvaZap.
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Chave API Google Gemini</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="password"
                                            className="form-input w-full"
                                            placeholder="AIzaSy..."
                                            value={formData.geminiApiKey}
                                            onChange={e => setFormData({ ...formData, geminiApiKey: e.target.value })}
                                            style={{ paddingRight: '2.5rem' }}
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '11px', opacity: 0.5 }}>
                                            <Globe size={16} />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                        Esta chave será usada para análise e resumo de transcrições de áudio.
                                    </p>
                                </div>
                            </div>

                            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}
                                >
                                    <Save size={18} />
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                {activeTab === 'image_bank' && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                <ImageIcon size={32} />
                            </div>
                            <div>
                                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Configurações de Banco de Imagens</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Defina como o sistema deve buscar imagens para os seus encartes e produtos.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="glass-card" style={{ boxShadow: 'none', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                                <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Fonte de Imagens Personalizada</h3>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ fontWeight: 600 }}>URL do Banco de Imagens Próprio</label>
                                    <input
                                        type="text"
                                        className="form-input w-full"
                                        placeholder="Ex: https://meuservidor.com/fotos/{{code}}.png"
                                        value={formData.imageBankSettings.customUrl}
                                        onChange={e => setFormData({
                                            ...formData,
                                            imageBankSettings: { ...formData.imageBankSettings, customUrl: e.target.value }
                                        })}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                        Use as tags <code>{"{{code}}"}</code> (EAN/Interno) ou <code>{"{{name}}"}</code> (Nome do Produto) no local da imagem.
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '1rem' }}>Prioridade de Busca</label>
                                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="priority"
                                                checked={formData.imageBankSettings.priority === 'company'}
                                                onChange={() => setFormData({
                                                    ...formData,
                                                    imageBankSettings: { ...formData.imageBankSettings, priority: 'company' }
                                                })}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>Priorizar meu banco próprio</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="priority"
                                                checked={formData.imageBankSettings.priority === 'global'}
                                                onChange={() => setFormData({
                                                    ...formData,
                                                    imageBankSettings: { ...formData.imageBankSettings, priority: 'global' }
                                                })}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>Usar banco global do CanvaZap</span>
                                        </label>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                        O banco global oficial é: <code>https://imagens.canvazap.com.br/codbarras/{"{{code}}"}.png</code>
                                    </p>
                                </div>
                            </div>

                            <div className="glass-card" style={{ boxShadow: 'none', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                                <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Facilitadores de Busca</h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.imageBankSettings.searchByInternalCode}
                                            onChange={e => setFormData({
                                                ...formData,
                                                imageBankSettings: { ...formData.imageBankSettings, searchByInternalCode: e.target.checked }
                                            })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Buscar pelo Código Interno</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tenta localizar a imagem usando o seu código de sistema caso o EAN não retorne resultado.</div>
                                        </div>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.imageBankSettings.searchByName}
                                            onChange={e => setFormData({
                                                ...formData,
                                                imageBankSettings: { ...formData.imageBankSettings, searchByName: e.target.checked }
                                            })}
                                            style={{ width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Buscar pelo Nome do Produto</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Utiliza o nome/descrição para buscar em bancos de imagens regionais ou locais.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}
                                >
                                    <Save size={18} />
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'webhooks' && <WebhookSettings />}

                {activeTab === 'art_guidelines' && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: '#F59E0B' }}>
                                <Wand2 size={32} />
                            </div>
                            <div>
                                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Diretrizes de Arte IA</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Configurações visuais e de comunicação para geração de artes.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            <div className="glass-card" style={{ boxShadow: 'none', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                                <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Comunicação Verbal</h3>
                                <div className="form-group">
                                    <label className="form-label">Contexto e Tom de Voz</label>
                                    <textarea
                                        className="form-input"
                                        rows={4}
                                        placeholder="Ex: Somos uma marca jovem e divertida. Usamos gírias e emojis. Nosso público alvo são jovens de 18-25 anos..."
                                        value={formData.toneOfVoice}
                                        onChange={e => setFormData({ ...formData, toneOfVoice: e.target.value })}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                        Descreva como a IA deve "falar" e se comportar ao criar textos para as artes.
                                    </p>
                                </div>
                            </div>

                            <div className="glass-card" style={{ boxShadow: 'none', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
                                <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Identidade Visual</h3>
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label">Diretrizes Visuais Gerais</label>
                                    <textarea
                                        className="form-input"
                                        rows={3}
                                        placeholder="Ex: Estilo minimalista, muita luz natural, pessoas felizes, fundos desfocados..."
                                        value={formData.visualGuidelines}
                                        onChange={e => setFormData({ ...formData, visualGuidelines: e.target.value })}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={16} /> O que PODE conter
                                    </label>
                                    <textarea
                                        className="form-input"
                                        rows={2}
                                        placeholder="Ex: Pessoas sorrindo, luz natural, cores vibrantes..."
                                        value={formData.visualAllowed}
                                        onChange={e => setFormData({ ...formData, visualAllowed: e.target.value })}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <XCircle size={16} /> O que NÃO PODE conter
                                    </label>
                                    <textarea
                                        className="form-input"
                                        rows={2}
                                        placeholder="Ex: Texto excessivo, cores escuras, pessoas tristes..."
                                        value={formData.visualForbidden}
                                        onChange={e => setFormData({ ...formData, visualForbidden: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Referências Visuais (Treinamento de Estilo)</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        {formData.referenceImages.map((url, idx) => (
                                            <div key={idx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                                <img src={url} alt={`Ref ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => removeReferenceImage(idx)}
                                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <div
                                            onClick={() => document.getElementById('ref-upload')?.click()}
                                            style={{
                                                aspectRatio: '1/1',
                                                borderRadius: '8px',
                                                border: '2px dashed var(--border-color)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                gap: '8px'
                                            }}
                                        >
                                            {uploading ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
                                            <span style={{ fontSize: '0.8rem' }}>Adicionar</span>
                                        </div>
                                        <input id="ref-upload" type="file" hidden onChange={handleReferenceUpload} accept="image/*" />
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Faça upload de imagens que representam o estilo visual que você quer que a IA siga (Ex: Artes de referência, fotos de estilo).
                                    </p>
                                </div>
                            </div>

                            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}
                                >
                                    <Save size={18} />
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                <ImageIcon size={32} />
                            </div>
                            <div>
                                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Produtos & Embalagens</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Cadastre seus produtos para usá-los na geração de artes com IA.</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            {formData.products.map((product, idx) => (
                                <div key={product.id} className="glass-card" style={{ padding: '1rem', position: 'relative' }}>
                                    <div style={{ aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: '#f8fafc' }}>
                                        <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={product.name}
                                            onChange={(e) => {
                                                const newProducts = [...formData.products];
                                                newProducts[idx].name = e.target.value;
                                                setFormData(prev => ({ ...prev, products: newProducts }));
                                            }}
                                            placeholder="Nome do Produto"
                                            style={{ width: '100%' }}
                                        />

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Larg (cm)</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={(product as any).width || ''}
                                                    onChange={(e) => {
                                                        const newProducts: any = [...formData.products];
                                                        newProducts[idx].width = parseFloat(e.target.value);
                                                        setFormData(prev => ({ ...prev, products: newProducts }));
                                                    }}
                                                    placeholder="0"
                                                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Alt (cm)</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={(product as any).height || ''}
                                                    onChange={(e) => {
                                                        const newProducts: any = [...formData.products];
                                                        newProducts[idx].height = parseFloat(e.target.value);
                                                        setFormData(prev => ({ ...prev, products: newProducts }));
                                                    }}
                                                    placeholder="0"
                                                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Prof (cm)</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={(product as any).depth || ''}
                                                    onChange={(e) => {
                                                        const newProducts: any = [...formData.products];
                                                        newProducts[idx].depth = parseFloat(e.target.value);
                                                        setFormData(prev => ({ ...prev, products: newProducts }));
                                                    }}
                                                    placeholder="0"
                                                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeProduct(idx)}
                                        style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            <div
                                onClick={() => document.getElementById('prod-upload')?.click()}
                                className="glass-card"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '320px',
                                    border: '2px dashed var(--border-color)',
                                    cursor: 'pointer',
                                    gap: '1rem',
                                    boxShadow: 'none'
                                }}
                            >
                                {uploading ? <Loader2 className="animate-spin" size={32} /> : <Plus size={32} color="var(--primary-color)" />}
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Adicionar Produto</span>
                            </div>
                            <input id="prod-upload" type="file" hidden onChange={handleProductUpload} accept="image/*" />
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                onClick={handleSave}
                                className="btn btn-primary"
                                disabled={saving}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}
                            >
                                <Save size={18} />
                                {saving ? 'Salvando...' : 'Salvar Produtos'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: '#6366f1' }}>
                                <Code size={32} />
                            </div>
                            <div>
                                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Acesso API</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>Gerencie as chaves de acesso para integrações externas (n8n, Zapier, etc).</p>
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h3 className="title font-bold text-lg mb-2">Chave de API (Bearer Token)</h3>
                                <p className="text-gray-500 text-sm mb-4">
                                    Use esta chave no cabeçalho <code>Authorization</code> das suas requisições HTTP para autenticar.
                                </p>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{
                                        flex: 1,
                                        background: '#1e293b',
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        fontFamily: 'monospace',
                                        color: '#cbd5e1',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span>{formData.apiKey || 'Nenhuma chave gerada'}</span>
                                        {formData.apiKey && (
                                            <button
                                                onClick={() => copyToClipboard(formData.apiKey)}
                                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}
                                                title="Copiar"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={generateNewApiKey}
                                        className="btn btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                                    >
                                        <RefreshCw size={16} />
                                        {formData.apiKey ? 'Redefinir Chave' : 'Gerar Chave'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                                <h4 className="font-bold mb-2">Exemplo de Uso (cURL)</h4>
                                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#94a3b8', fontSize: '0.85rem' }}>
                                    <pre>{`curl -X POST "https://eco-d3.vercel.app/api/merchandise" \\
  -H "Authorization: Bearer ${formData.apiKey || 'SUA_CHAVE_AQUI'}" \\
  -H "Content-Type: application/json" \\
  -d '{"data": "..."}'`}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyProfile;
