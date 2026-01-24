
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, Timestamp, arrayUnion, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Plus, Search, Calendar, Clock, Image as ImageIcon, CheckCircle2, XCircle,
    MoreVertical, Paperclip, Send, Loader2, Filter, ChevronDown,
    Layers, Layout, Share2, MessageSquare, Trash2, Edit3, Eye,
    Maximize2, Download, AlertCircle, FileText, CheckCircle, X,
    Instagram, Facebook, Smartphone, Monitor, Wand2, Info,
    Heart, MessageCircle, Bookmark, Globe, RotateCcw, ChevronLeft, ChevronRight,
    Building2, Settings, Save
} from 'lucide-react';
import { uploadToR2 } from '../services/r2Service';
import { ArtApprovalItem, ArtFile, ArtStatus, SocialMediaType } from './ArtApprovalTypes';

const FORMAT_OPTIONS = [
    { value: 'FEED', label: 'Feed', dims: '1080x1350' },
    { value: 'REELS', label: 'Video Reels', dims: '1080x1920' },
    { value: 'STORIES', label: 'Stories', dims: '1080x1920' },
    { value: 'OUTRO', label: 'Outro', dims: '' }
];

const detectFormat = (width: number, height: number): SocialMediaType => {
    if (width === 0 || height === 0) return 'FEED';
    const ratio = width / height;
    if (ratio <= 0.6) return 'STORIES'; // stories/reels 9:16 (~0.56)
    if (ratio > 0.6 && ratio <= 1.25) return 'FEED'; // feed 4:5 ou 1:1 (~0.8-1.0)
    return 'OUTRO';
};

const ArtApprovalModule = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'create' | 'approval'>('approval');
    const [items, setItems] = useState<ArtApprovalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [selectedItem, setSelectedItem] = useState<ArtApprovalItem | null>(null);
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);
    const [taskCategories, setTaskCategories] = useState<any[]>([]);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [guidelinesPode, setGuidelinesPode] = useState('');
    const [guidelinesNaoPode, setGuidelinesNaoPode] = useState('');

    const OPENAI_KEY = companyInfo?.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        category: '',
        subcategoryId: '',
        type: 'FEED' as SocialMediaType,
        caption: '',
        postingDate: '',
        creatorId: '',
        approverIds: [] as string[]
    });
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<{ file: File, preview: string, width: number, height: number }[]>([]);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
    const [previewPlatform, setPreviewPlatform] = useState<'INSTA' | 'FACE'>('INSTA');
    const [approverSearch, setApproverSearch] = useState('');
    const [showApproverList, setShowApproverList] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const approverRef = useRef<HTMLDivElement>(null);

    // Close approver list when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (approverRef.current && !approverRef.current.contains(event.target as Node)) {
                setShowApproverList(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!userData) return;

        // Fetch Company AI Key
        const fetchSettings = async () => {
            if (userData.companyId) {
                const compDoc = await getDoc(doc(db, 'companies', userData.companyId));
                if (compDoc.exists()) {
                    const data = compDoc.data();
                    setCompanyInfo({ id: compDoc.id, ...data });
                    setGuidelinesPode(data.guidelinesPode || '');
                    setGuidelinesNaoPode(data.guidelinesNaoPode || '');
                }
            }
        };
        fetchSettings();

        const q = userData.role === 'super_admin'
            ? query(collection(db, 'art_approvals'), orderBy('createdAt', 'desc'))
            : query(collection(db, 'art_approvals'), where('companyId', '==', userData.companyId), orderBy('createdAt', 'desc'));

        const unsub = onSnapshot(q, (snap) => {
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ArtApprovalItem)));
            setLoading(false);
        });

        // Users Listener
        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
            const filtered = userData.role === 'super_admin'
                ? allUsers
                : allUsers.filter((u: any) => u.companyId === userData.companyId);
            setCompanyUsers(filtered);
        });

        // Categories Listener
        const unsubCats = onSnapshot(collection(db, 'task_categories'), (snap) => {
            setTaskCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsub(); unsubUsers(); unsubCats(); };
    }, [userData]);

    const getDimensions = (file: File): Promise<{ width: number, height: number }> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) { resolve({ width: 0, height: 0 }); return; }
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => resolve({ width: 0, height: 0 });
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const enriched: { file: File, preview: string, width: number, height: number }[] = [];
            for (const file of files) {
                const dims = await getDimensions(file);
                enriched.push({ file, preview: URL.createObjectURL(file), width: dims.width, height: dims.height });
            }
            setSelectedFiles(prev => [...prev, ...enriched]);

            if (enriched.length > 0) {
                const format = detectFormat(enriched[0].width, enriched[0].height);
                setFormData(prev => ({ ...prev, type: format }));

                // Automatic AI Review using OpenAI
                setTimeout(() => analyzeImagesWithOpenAI([...selectedFiles, ...enriched].map(e => ({ file: e.file, preview: e.preview }))), 500);
            }
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('dragIndex', index.toString());
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
        if (dragIndex === dropIndex) return;

        const newFiles = [...selectedFiles];
        const [movedItem] = newFiles.splice(dragIndex, 1);
        newFiles.splice(dropIndex, 0, movedItem);
        setSelectedFiles(newFiles);
    };

    const analyzeImagesWithOpenAI = async (mediaItems: { file: File, preview: string }[]) => {
        if (!OPENAI_KEY || mediaItems.length === 0) return;
        setIsAnalyzing(true);
        setAiReport(null);
        try {
            const base64Parts = await Promise.all(mediaItems.map(async item => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.readAsDataURL(item.file);
                });
            }));

            const guidelinesPrompt = `
                DIRETRIZES DA EMPRESA:
                PODE: ${guidelinesPode || 'Não especificado'}
                NÃO PODE: ${guidelinesNaoPode || 'Não especificado'}
            `;

            const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: `Você é um especialista em marketing e revisor. Analise as imagens do post considerando as seguintes diretrizes da empresa: ${guidelinesPrompt}. Retorne: 1. Revisão de português e conformidade com as diretrizes. 2. Um Título chamativo. 3. Uma Legenda engajadora com emojis e hashtags. Use EXATAMENTE este formato: [REVISAO] texto aqui [TITULO] texto aqui [LEGENDA] texto aqui. Retorne em português do Brasil.` },
                                ...base64Parts.map(b64 => ({
                                    type: "image_url",
                                    image_url: { url: `data:image/jpeg;base64,${b64}` }
                                }))
                            ]
                        }
                    ],
                    max_tokens: 800
                })
            });
            const data = await response.json();
            const report = data.choices?.[0]?.message?.content;
            if (report) setAiReport(report);
            else setAiReport("Não foi possível gerar o relatório. Verifique a chave da API.");
        } catch (err) {
            console.error("OpenAI Analysis error:", err);
            setAiReport("Erro técnico ao processar revisão com OpenAI.");
        } finally { setIsAnalyzing(false); }
    };

    const parseAiSuggestions = () => {
        if (!aiReport) return { revision: '', title: '', caption: '' };
        const revision = aiReport.split('[REVISAO]')[1]?.split('[TITULO]')[0]?.trim() || '';
        const title = aiReport.split('[TITULO]')[1]?.split('[LEGENDA]')[0]?.trim() || '';
        const caption = aiReport.split('[LEGENDA]')[1]?.trim() || '';
        return { revision, title, caption };
    };

    const handleSaveGuidelines = async () => {
        if (!userData?.companyId) return;
        try {
            await updateDoc(doc(db, 'companies', userData.companyId), {
                guidelinesPode,
                guidelinesNaoPode,
                updatedAt: serverTimestamp()
            });
            setShowSettingsModal(false);
            alert('Diretrizes salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar diretrizes.');
        }
    };

    const handleGenerateAIWithOpenAI = async () => {
        if (!OPENAI_KEY || !formData.title) return alert('Dê um título ao post primeiro!');
        try {
            const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "user", content: `Gere uma legenda criativa e engajadora para um post de rede social com o título: ${formData.title}. Adicione emojis e hashtags relevantes.` }
                    ]
                })
            });
            const data = await response.json();
            const aiText = data.choices?.[0]?.message?.content;
            if (aiText) setFormData(prev => ({ ...prev, caption: aiText }));
        } catch (err) { console.error(err); }
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData || selectedFiles.length === 0) return;
        if (!formData.creatorId) return alert('Selecione um Criador');

        setUploadingFiles(true);
        try {
            const uploadedArtFiles: ArtFile[] = [];
            let totalWidth = 0, totalHeight = 0;

            for (const item of selectedFiles) {
                const url = await uploadToR2(item.file, `approvals/${Date.now()}_${item.file.name}`);
                uploadedArtFiles.push({ url, name: item.file.name, type: item.file.type, size: item.file.size, width: item.width, height: item.height });
                if (item.width > 0) { totalWidth = item.width; totalHeight = item.height; }
            }

            const postDate = formData.postingDate ? new Date(formData.postingDate) : new Date();
            const timeline = {
                draftDue: Timestamp.fromDate(new Date(postDate.getTime() - 4 * 24 * 60 * 60 * 1000)),
                approvalDue: Timestamp.fromDate(new Date(postDate.getTime() - 2 * 24 * 60 * 60 * 1000)),
                finalDue: Timestamp.fromDate(new Date(postDate.getTime() - 1 * 24 * 60 * 60 * 1000)),
            };

            const initialVersion = {
                versionNumber: 1,
                files: uploadedArtFiles,
                caption: formData.caption,
                createdAt: Timestamp.now(),
                createdBy: userData.uid
            };

            const cat = taskCategories.find(c => c.id === formData.category);
            const sub = taskCategories.find(c => c.id === formData.subcategoryId);

            await addDoc(collection(db, 'art_approvals'), {
                ...formData,
                category: cat?.name || '',
                subcategory: sub?.name || '',
                postingDate: Timestamp.fromDate(postDate),
                files: uploadedArtFiles,
                isCarousel: selectedFiles.length > 1,
                dimensions: totalWidth > 0 ? `${totalWidth}x${totalHeight}` : 'Video/Outro',
                status: 'PENDING_APPROVAL',
                companyId: userData.companyId,
                createdBy: userData.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                currentVersion: 1,
                versions: [initialVersion],
                timeline
            });

            setActiveTab('approval');
            setFormData({ title: '', category: '', subcategoryId: '', type: 'FEED', caption: '', postingDate: '', creatorId: '', approverIds: [] });
            setSelectedFiles([]);
            setAiReport(null);
            setShowApproverList(false);
        } catch (error) { console.error(error); alert('Erro ao criar item.'); }
        finally { setUploadingFiles(false); }
    };

    const handleUpdateStatus = async (itemId: string, newStatus: ArtStatus, feedbackText?: string, versionNumber?: number) => {
        const updateData: any = { status: newStatus, updatedAt: serverTimestamp() };
        if (feedbackText && userData) {
            const feedback = { userId: userData.uid, userName: userData.displayName || userData.email, text: feedbackText, createdAt: Timestamp.now(), versionNumber: versionNumber || 1.0 };
            updateData.feedback = arrayUnion(feedback);
        }
        await updateDoc(doc(db, 'art_approvals', itemId), updateData);
        setSelectedItem(prev => prev ? { ...prev, status: newStatus, feedback: feedbackText ? [...(prev.feedback || []), { userId: userData!.uid, userName: userData!.displayName || userData!.email, text: feedbackText, createdAt: Timestamp.now(), versionNumber: versionNumber || 1.0 }] : prev.feedback } : null);
    };

    const handleAddFeedback = async (itemId: string, text: string, versionNumber?: number) => {
        if (!userData || !text.trim()) return;
        const feedback = { userId: userData.uid, userName: userData.displayName || userData.email, text, createdAt: Timestamp.now(), versionNumber: versionNumber || 1.0 };
        await updateDoc(doc(db, 'art_approvals', itemId), { feedback: arrayUnion(feedback), updatedAt: serverTimestamp() });
        setSelectedItem(prev => prev ? { ...prev, feedback: [...(prev.feedback || []), feedback] } : null);
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Deseja realmente excluir esta demanda? Esta ação não pode ser desfeita.')) return;
        try {
            await deleteDoc(doc(db, 'art_approvals', itemId));
            setSelectedItem(null);
            alert('Demanda excluída com sucesso.');
        } catch (error) {
            console.error(error);
            alert('Erro ao excluir demanda.');
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;

        // Regra de Privacidade: Apenas envolvidos veem a arte
        const isSuperAdmin = userData?.role === 'super_admin';
        const isDocCreator = item.createdBy === userData?.uid; // Quem criou o post
        const isAssignedCreator = item.creatorId === userData?.uid; // O design
        const isApprover = item.approverIds?.includes(userData?.uid || ''); // Os aprovadores

        const hasPermission = isSuperAdmin || isDocCreator || isAssignedCreator || isApprover;

        return matchesSearch && matchesStatus && hasPermission;
    });

    const parentCategories = taskCategories.filter(c => !c.parentId);
    const subCategories = taskCategories.filter(c => c.parentId === formData.category);

    return (
        <div className="fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="title" style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CheckCircle2 className="text-secondary" /> Aprovação de Artes
                    </h1>
                </div>
                <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setActiveTab('create')}>
                    <Plus size={18} /> Criar Nova Demanda
                </button>
            </div>

            <div className="glass-card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className={`btn-tab ${activeTab === 'approval' ? 'active' : ''}`} onClick={() => setActiveTab('approval')} style={tabStyle(activeTab === 'approval')}>
                        <Layout size={14} style={{ marginRight: '6px' }} /> Itens para Aprovação
                    </button>
                    <button className={`btn-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')} style={tabStyle(activeTab === 'create')}>
                        <Plus size={14} style={{ marginRight: '6px' }} /> Criar Demanda
                    </button>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 1rem' }} />
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Filtrar artes..." className="form-input" style={{ paddingLeft: '2.2rem', height: '34px', width: '220px', fontSize: '0.8rem', background: 'transparent' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 1rem' }} />
                    <button
                        className="btn-tab"
                        onClick={() => setShowSettingsModal(true)}
                        style={{ ...tabStyle(false), color: 'var(--text-secondary)' }}
                        title="Configurações de IA"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {activeTab === 'create' ? (
                    <div style={{ display: 'flex', height: '100%', gap: '1px', background: 'rgba(0,0,0,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
                        <div style={{ flex: 1, background: 'white', padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="form-group" style={{ margin: 0, width: '220px' }}>
                                    <label className="form-label" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>Formato do Post</label>
                                    <select
                                        className="form-input"
                                        style={{ height: '32px', fontSize: '0.75rem', padding: '0 8px', background: '#f8fafc', fontWeight: 800 }}
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as SocialMediaType })}
                                    >
                                        {FORMAT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label} {opt.dims ? `(${opt.dims})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <form onSubmit={handleCreateItem}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Título do Post</label>
                                        <input className="form-input" style={{ background: '#f8fafc' }} required placeholder="Ex: Campanha X" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Criador da Arte</label>
                                        <select className="form-input" style={{ background: '#f8fafc' }} required value={formData.creatorId} onChange={e => setFormData({ ...formData, creatorId: e.target.value })}>
                                            <option value="">Selecione o criador...</option>
                                            {companyUsers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Categoria</label>
                                        <select className="form-input" style={{ background: '#f8fafc' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, subcategoryId: '' })}>
                                            <option value="">Selecione...</option>
                                            {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Subcategoria</label>
                                        <select className="form-input" style={{ background: '#f8fafc' }} value={formData.subcategoryId} onChange={e => setFormData({ ...formData, subcategoryId: e.target.value })} disabled={subCategories.length === 0}>
                                            <option value="">{subCategories.length > 0 ? 'Selecione...' : 'Sem subcategoria'}</option>
                                            {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }} ref={approverRef}>
                                    <label className="form-label">Aprovadores</label>
                                    <div onClick={() => setShowApproverList(!showApproverList)} style={{ minHeight: '42px', padding: '8px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                        {formData.approverIds.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Selecione os aprovadores...</span>}
                                        {formData.approverIds.map(id => (
                                            <div key={id} style={{ background: '#4318FF', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {companyUsers.find(u => u.uid === id)?.displayName || id}
                                                <X size={12} onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, approverIds: prev.approverIds.filter(x => x !== id) })); }} />
                                            </div>
                                        ))}
                                        <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                                    </div>
                                    {showApproverList && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                                            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                <input autoFocus className="form-input" placeholder="Buscar aprovador..." value={approverSearch} onChange={e => setApproverSearch(e.target.value)} onClick={e => e.stopPropagation()} />
                                            </div>
                                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                {companyUsers.filter(u => (u.displayName || u.email).toLowerCase().includes(approverSearch.toLowerCase())).map(u => (
                                                    <div key={u.uid} onClick={(e) => { e.stopPropagation(); const exists = formData.approverIds.includes(u.uid); setFormData(prev => ({ ...prev, approverIds: exists ? prev.approverIds.filter(id => id !== u.uid) : [...prev.approverIds, u.uid] })); }} style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: formData.approverIds.includes(u.uid) ? '#f8fafc' : 'white' }}>
                                                        {u.displayName || u.email} {formData.approverIds.includes(u.uid) && <CheckCircle size={14} color="#10b981" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label className="form-label">Legenda do Post</label>
                                        <button type="button" onClick={handleGenerateAIWithOpenAI} style={{ background: 'none', border: 'none', color: '#4318FF', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}><Wand2 size={12} /> GERAR COM IA</button>
                                    </div>
                                    <textarea className="form-input" style={{ minHeight: '120px', background: '#f8fafc' }} value={formData.caption} onChange={e => setFormData({ ...formData, caption: e.target.value })} />
                                </div>

                                {isAnalyzing && <div style={{ color: 'var(--primary-color)', fontSize: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Loader2 size={14} className="animate-spin" /> Analisando imagens com IA...</div>}
                                {aiReport && (
                                    <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '16px', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.85rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a3412', fontWeight: 800, marginBottom: '12px', borderBottom: '1px solid #ffedd5', paddingBottom: '8px' }}>
                                            <Wand2 size={16} /> SUGESTÕES DA INTELIGÊNCIA ARTIFICIAL
                                        </div>

                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#c2410c', textTransform: 'uppercase', marginBottom: '4px' }}>Revisão de Texto</div>
                                            <div style={{ color: '#c2410c', opacity: 0.9 }}>{parseAiSuggestions().revision}</div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#9a3412', marginBottom: '4px' }}>Sugestão de Título</div>
                                                <div style={{ fontSize: '0.8rem', color: '#444', marginBottom: '8px' }}>{parseAiSuggestions().title}</div>
                                                <button type="button" onClick={() => setFormData({ ...formData, title: parseAiSuggestions().title })} style={{ width: '100%', padding: '4px', background: '#4318FF', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Aplicar Título</button>
                                            </div>
                                            <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#9a3412', marginBottom: '4px' }}>Sugestão de Legenda</div>
                                                <div style={{ fontSize: '0.8rem', color: '#444', marginBottom: '8px', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parseAiSuggestions().caption}</div>
                                                <button type="button" onClick={() => setFormData({ ...formData, caption: parseAiSuggestions().caption })} style={{ width: '100%', padding: '4px', background: '#4318FF', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Aplicar Legenda</button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <button type="button" onClick={() => analyzeImagesWithOpenAI(selectedFiles)} style={{ background: 'none', border: 'none', color: '#4318FF', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={12} /> Refazer Análise</button>
                                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Model: GPT-4o-mini</span>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                    {selectedFiles.map((f, i) => (
                                        <div
                                            key={i}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, i)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => handleDrop(e, i)}
                                            style={{
                                                position: 'relative',
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                border: '1px solid #e2e8f0',
                                                cursor: 'grab'
                                            }}
                                        >
                                            <img src={f.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', width: '16px', height: '16px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} /></button>
                                        </div>
                                    ))}
                                    <div onClick={() => fileInputRef.current?.click()} style={{ width: '60px', height: '60px', borderRadius: '8px', border: '2px dashed #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}><Plus /></div>
                                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                                </div>

                                <button type="submit" disabled={uploadingFiles} className="btn" style={{ width: '100%', height: '48px', background: '#0f172a', color: 'white', fontWeight: 700, borderRadius: '12px' }}>{uploadingFiles ? 'Enviando...' : 'Enviar para Aprovação'}</button>
                            </form>
                        </div>

                        <div style={{ width: '45%', background: '#f8fafc', padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                                {previewPlatform === 'INSTA' ?
                                    <InstagramMockup
                                        company={companyInfo}
                                        media={selectedFiles.map(f => f.preview)}
                                        caption={formData.caption}
                                        type={formData.type}
                                        currentIndex={currentPreviewIndex}
                                        onIndexChange={setCurrentPreviewIndex}
                                    /> :
                                    <FacebookMockup
                                        company={companyInfo}
                                        media={selectedFiles.map(f => f.preview)}
                                        caption={formData.caption}
                                        type={formData.type}
                                        currentIndex={currentPreviewIndex}
                                        onIndexChange={setCurrentPreviewIndex}
                                    />
                                }
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '1.5rem', height: '100%', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
                        {[
                            { id: 'PENDING_APPROVAL', label: 'Em aprovação', color: '#4318FF' },
                            { id: 'REJECTED', label: 'Ajustes solicitados', color: '#f59e0b' },
                            { id: 'APPROVED', label: 'Aprovados', color: '#10b981' },
                            { id: 'REJECTED_TOTAL', label: 'Reprovados totalmente', color: '#64748b', isGray: true }
                        ].map(col => (
                            <div key={col.id} style={{ minWidth: '320px', flex: 1, background: 'rgba(0,0,0,0.02)', borderRadius: '16px', display: 'flex', flexDirection: 'column', maxHeight: '100%', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: col.color, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                                        {col.label}
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'white', padding: '2px 8px', borderRadius: '100px', color: '#64748b' }}>
                                        {filteredItems.filter(i => i.status === col.id).length}
                                    </span>
                                </div>
                                <div style={{ padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', opacity: col.isGray ? 0.6 : 1 }}>
                                    {filteredItems.filter(i => i.status === col.id).map(item => (
                                        <ArtCard key={item.id} item={item} onClick={() => setSelectedItem(item)} isGray={col.isGray} />
                                    ))}
                                    {filteredItems.filter(i => i.status === col.id).length === 0 && (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', border: '2px dashed rgba(0,0,0,0.05)', borderRadius: '12px' }}>Vazio</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedItem && (
                <ArtDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onAddFeedback={handleAddFeedback}
                    onDelete={handleDeleteItem}
                    companyUsers={companyUsers}
                    companyInfo={companyInfo}
                />
            )}

            {showSettingsModal && (
                <div className="modal-overlay" style={{ zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={20} color="var(--primary-color)" /> Diretrizes da IA
                            </h3>
                            <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Defina o que a Inteligência Artificial deve priorizar ou evitar ao realizar a revisão automática das artes desta empresa.
                        </p>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle size={16} /> Pode / Deve conter:
                            </label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '80px', background: '#f8fafc' }}
                                placeholder="Ex: Linguagem formal, cores da marca, fontes específicas..."
                                value={guidelinesPode}
                                onChange={e => setGuidelinesPode(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <XCircle size={16} /> NÃO pode / Evitar:
                            </label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '80px', background: '#f8fafc' }}
                                placeholder="Ex: Gírias, fundos escuros, fotos de baixa qualidade..."
                                value={guidelinesNaoPode}
                                onChange={e => setGuidelinesNaoPode(e.target.value)}
                            />
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={handleSaveGuidelines}
                        >
                            <Save size={18} /> Salvar Orientações
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ArtDetailModal = ({ item, onClose, onUpdateStatus, onAddFeedback, onDelete, companyUsers, companyInfo }: any) => {
    const { userData } = useAuth();
    const [comment, setComment] = useState(''), [activeFile, setActiveFile] = useState(0), [isUploading, setIsUploading] = useState(false);
    const [previewPlatform, setPreviewPlatform] = useState<'INSTA' | 'FACE'>('INSTA');
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);
    const [editCaption, setEditCaption] = useState(item.caption);
    const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
    const [adjustmentText, setAdjustmentText] = useState('');

    // Version States
    const versions = item.versions || [{ versionNumber: 1.0, files: item.files, caption: item.caption }];
    const [viewingVersionIndex, setViewingVersionIndex] = useState(versions.length - 1);
    const currentViewVersion = versions[viewingVersionIndex];

    // Version Upload States
    const [showVersionUpload, setShowVersionUpload] = useState(false);
    const [versionFiles, setVersionFiles] = useState<{ file: File, preview: string, width: number, height: number }[]>([]);
    const [newVersionCaption, setNewVersionCaption] = useState(item.caption);
    const [isAnalyzingVersion, setIsAnalyzingVersion] = useState(false);
    const [aiReportVersion, setAiReportVersion] = useState<string | null>(null);
    const [currentPreviewIndexVersion, setCurrentPreviewIndexVersion] = useState(0);

    const versionFileInputRef = useRef<HTMLInputElement>(null);
    const OPENAI_KEY = companyInfo?.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;

    const handleFileSelectVersion = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const enriched = files.map((file: File) => ({
                file,
                preview: URL.createObjectURL(file),
                width: 0, height: 0
            }));
            setVersionFiles(prev => [...prev, ...enriched]);
        }
    };

    const analyzeImagesWithOpenAIVersion = async () => {
        if (!OPENAI_KEY || versionFiles.length === 0) return;
        setIsAnalyzingVersion(true);
        try {
            const base64Files = await Promise.all(versionFiles.map(vFile => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(vFile.file);
                });
            }));

            const guidelinesPrompt = `PODE: ${companyInfo?.guidelinesPode || 'N/A'}. NÃO PODE: ${companyInfo?.guidelinesNaoPode || 'N/A'}`;

            const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: `Analise as novas artes conforme: ${guidelinesPrompt}. Retorne REVISAO e LEGENDA no formato padrâo [REVISAO]... [LEGENDA]...` },
                            ...base64Files.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }))
                        ]
                    }],
                    max_tokens: 800
                })
            });

            const data = await response.json();
            setAiReportVersion(data.choices[0].message.content);
        } catch (error) { console.error(error); } finally { setIsAnalyzingVersion(false); }
    };

    const handleVersionUpload = async () => {
        if (!userData || versionFiles.length === 0) return;
        setIsUploading(true);
        try {
            const uploadedArtFiles: ArtFile[] = [];
            for (const itemF of versionFiles) {
                const url = await uploadToR2(itemF.file, `approvals/${Date.now()}_${itemF.file.name}`);
                uploadedArtFiles.push({ url, name: itemF.file.name, type: itemF.file.type, size: itemF.file.size });
            }
            const currentV = typeof item.currentVersion === 'number' ? item.currentVersion : 1.0;
            const newVersionNum = Number((currentV + 0.1).toFixed(1));

            await updateDoc(doc(db, 'art_approvals', item.id), {
                files: uploadedArtFiles,
                caption: newVersionCaption,
                status: 'PENDING_APPROVAL',
                currentVersion: newVersionNum,
                versions: arrayUnion({ versionNumber: newVersionNum, files: uploadedArtFiles, caption: newVersionCaption, createdAt: Timestamp.now(), createdBy: userData.uid }),
                updatedAt: serverTimestamp()
            });
            onClose();
        } catch (error) { console.error(error); } finally { setIsUploading(false); }
    };

    const handleSaveEdits = async () => {
        try {
            await updateDoc(doc(db, 'art_approvals', item.id), { title: editTitle, caption: editCaption, updatedAt: serverTimestamp() });
            setIsEditing(false);
            alert('Alterações salvas!');
        } catch (error) { console.error(error); }
    };

    const filteredFeedback = (item.feedback || []).filter((f: any) => {
        const vNum = f.versionNumber || 1.0;
        return vNum === currentViewVersion.versionNumber;
    });

    return (
        <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass-card shadow-2xl fade-in" style={{ width: '100%', maxWidth: '1150px', height: '90vh', padding: 0, display: 'flex', overflow: 'hidden', background: '#fff' }}>
                {showVersionUpload ? (
                    <div style={{ display: 'flex', width: '100%' }}>
                        <div style={{ flex: 1.3, background: 'white', padding: '2.5rem', overflowY: 'auto', borderRight: '1px solid #efefef' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Subir Nova Versão</h2>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Demanda: {item.title}</div>
                                </div>
                                <div style={{ fontSize: '0.75rem', padding: '4px 12px', background: 'var(--bg-color)', color: 'var(--primary-color)', borderRadius: '100px', fontWeight: 800 }}>VERSÃO {Number((item.currentVersion || 1) + 0.1).toFixed(1)}</div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label className="form-label">Legenda da Versão {Number((item.currentVersion || 1) + 0.1).toFixed(1)}</label>
                                    <button onClick={analyzeImagesWithOpenAIVersion} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}><Wand2 size={12} /> ANALISAR COM IA</button>
                                </div>
                                <textarea className="form-input" style={{ minHeight: '140px', background: '#f8fafc' }} value={newVersionCaption} onChange={e => setNewVersionCaption(e.target.value)} />

                                {isAnalyzingVersion && <div style={{ color: 'var(--primary-color)', fontSize: '0.75rem', marginTop: '10px' }}><Loader2 size={14} className="animate-spin" /> IA Analisando artes...</div>}
                                {aiReportVersion && (
                                    <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '8px', marginTop: '1rem', border: '1px solid #ffedd5' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.7rem', color: '#9a3412', marginBottom: '4px' }}>DISCORDÂNCIAS / SUGESTÕES IA</div>
                                        <div style={{ fontSize: '0.8rem', color: '#c2410c' }}>{(aiReportVersion.match(/\[REVISAO\](.*?)(\[TITULO\]|\[LEGENDA\]|$)/s)?.[1] || '').trim()}</div>
                                        <button onClick={() => {
                                            const sugg = (aiReportVersion.match(/\[LEGENDA\](.*?)$/s)?.[1] || '').trim();
                                            if (sugg) setNewVersionCaption(sugg);
                                        }} style={{ marginTop: '10px', background: '#4318FF', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>Aplicar Legenda Sugerida</button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                {versionFiles.map((f, i) => (
                                    <div key={i} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                        <img src={f.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button onClick={() => setVersionFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', width: '18px', height: '18px', borderRadius: '50%', color: 'white', border: 'none' }}><X size={12} /></button>
                                    </div>
                                ))}
                                <div onClick={() => versionFileInputRef.current?.click()} style={{ width: '70px', height: '70px', borderRadius: '8px', border: '2px dashed #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}><Plus /></div>
                                <input type="file" multiple ref={versionFileInputRef} style={{ display: 'none' }} onChange={handleFileSelectVersion} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-primary" style={{ flex: 1.5, height: '48px', fontWeight: 800 }} disabled={isUploading || versionFiles.length === 0} onClick={handleVersionUpload}>
                                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : `Enviar Versão ${Number((item.currentVersion || 1) + 0.1).toFixed(1)}`}
                                </button>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowVersionUpload(false)}>Cancelar</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '2rem', display: 'flex', background: 'white', padding: '4px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <button onClick={() => setPreviewPlatform('INSTA')} style={{ padding: '4px 12px', borderRadius: '6px', background: previewPlatform === 'INSTA' ? 'black' : 'white', color: previewPlatform === 'INSTA' ? 'white' : 'black', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>INSTA</button>
                                <button onClick={() => setPreviewPlatform('FACE')} style={{ padding: '4px 12px', borderRadius: '6px', background: previewPlatform === 'FACE' ? 'black' : 'white', color: previewPlatform === 'FACE' ? 'white' : 'black', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>FACE</button>
                            </div>
                            {previewPlatform === 'INSTA' ?
                                <InstagramMockup company={companyInfo} media={versionFiles.length > 0 ? versionFiles.map(f => f.preview) : item.files.map((f: any) => f.url)} caption={newVersionCaption} type={item.type} currentIndex={currentPreviewIndexVersion} onIndexChange={setCurrentPreviewIndexVersion} /> :
                                <FacebookMockup company={companyInfo} media={versionFiles.length > 0 ? versionFiles.map(f => f.preview) : item.files.map((f: any) => f.url)} caption={newVersionCaption} type={item.type} currentIndex={currentPreviewIndexVersion} onIndexChange={setCurrentPreviewIndexVersion} />
                            }
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflowY: 'auto', padding: '2rem' }}>
                            {/* Version Navigator instead of Platform Toggle */}
                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '6px 12px', borderRadius: '100px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <button
                                    onClick={() => setViewingVersionIndex(Math.max(0, viewingVersionIndex - 1))}
                                    disabled={viewingVersionIndex === 0}
                                    style={{ background: 'none', border: 'none', cursor: viewingVersionIndex === 0 ? 'default' : 'pointer', color: viewingVersionIndex === 0 ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center' }}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e293b', minWidth: '80px', textAlign: 'center' }}>
                                    VERSÃO {currentViewVersion.versionNumber.toFixed(1)}
                                </div>
                                <button
                                    onClick={() => setViewingVersionIndex(Math.min(versions.length - 1, viewingVersionIndex + 1))}
                                    disabled={viewingVersionIndex === versions.length - 1}
                                    style={{ background: 'none', border: 'none', cursor: viewingVersionIndex === versions.length - 1 ? 'default' : 'pointer', color: viewingVersionIndex === versions.length - 1 ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center' }}
                                >
                                    <ChevronRight size={20} />
                                </button>
                                <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 4px' }} />
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => setPreviewPlatform('INSTA')} style={{ background: previewPlatform === 'INSTA' ? '#f1f5f9' : 'none', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: previewPlatform === 'INSTA' ? '#4318FF' : '#94a3b8' }} title="Padrão Instagram"><Instagram size={14} /></button>
                                    <button onClick={() => setPreviewPlatform('FACE')} style={{ background: previewPlatform === 'FACE' ? '#f1f5f9' : 'none', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: previewPlatform === 'FACE' ? '#4318FF' : '#94a3b8' }} title="Padrão Facebook"><Facebook size={14} /></button>
                                </div>
                            </div>

                            {previewPlatform === 'INSTA' ?
                                <InstagramMockup company={companyInfo} media={currentViewVersion.files.map((f: any) => f.url)} caption={currentViewVersion.caption} type={item.type} currentIndex={activeFile} onIndexChange={setActiveFile} /> :
                                <FacebookMockup company={companyInfo} media={currentViewVersion.files.map((f: any) => f.url)} caption={currentViewVersion.caption} type={item.type} currentIndex={activeFile} onIndexChange={setActiveFile} />
                            }
                            <button onClick={onClose} style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'white', border: 'none', borderRadius: '50%', padding: '8px', color: '#64748b', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ width: '400px', background: 'white', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #efefef' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #efefef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    {isEditing ? <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 800, height: '36px' }} /> : <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{item.title}</h2>}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>{companyUsers.find((u: any) => u.uid === item.creatorId)?.photoUrl && <img src={companyUsers.find((u: any) => u.uid === item.creatorId).photoUrl} style={{ width: '100%' }} />}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{companyUsers.find((u: any) => u.uid === item.creatorId)?.displayName || 'Criador'}</div>
                                        <div style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '100px', background: 'var(--bg-color)', color: 'var(--primary-color)', fontWeight: 800 }}>V. {currentViewVersion.versionNumber.toFixed(1)}</div>
                                    </div>
                                </div>
                                {userData?.uid === item.creatorId && <button onClick={() => isEditing ? handleSaveEdits() : setIsEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: '8px' }}>{isEditing ? <CheckCircle size={20} /> : <Edit3 size={20} />}</button>}
                                {userData?.uid === item.createdBy && (
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                        title="Excluir Demanda"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>Legenda</h4>
                                {isEditing ? <textarea className="form-input" value={editCaption} onChange={e => setEditCaption(e.target.value)} style={{ minHeight: '120px', fontSize: '0.85rem' }} /> : <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{currentViewVersion.caption}</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', marginBottom: '8px' }}><h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', margin: 0 }}>Feedback</h4><span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{item.status}</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filteredFeedback.length === 0 && <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum comentário nesta versão.</div>}
                                    {filteredFeedback.map((f: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eee', flexShrink: 0 }}></div>
                                            <div><div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{f.userName}<span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.65rem' }}> · {f.createdAt instanceof Timestamp ? f.createdAt.toDate().toLocaleDateString() : ''}</span></div><div style={{ fontSize: '0.8rem', color: '#444', marginTop: '2px' }}>{f.text}</div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ padding: '1.5rem', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center' }}>
                                    <input className="form-input" style={{ flex: 1, height: '42px', borderRadius: '10px', fontSize: '0.85rem', background: 'white', border: '1px solid #e2e8f0' }} placeholder="Escreva um comentário..." value={comment} onChange={e => setComment(e.target.value)} />
                                    <button className="btn btn-primary" style={{ width: '48px', height: '42px', padding: 0 }} onClick={() => { onAddFeedback(item.id, comment, currentViewVersion.versionNumber); setComment(''); }}><Send size={18} /></button>
                                </div>
                                {(userData?.uid === item.creatorId || item.approverIds.includes(userData?.uid)) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {item.approverIds.includes(userData?.uid) && item.status === 'PENDING_APPROVAL' && (
                                            <>
                                                {isAdjustmentMode ? (
                                                    <div className="fade-in" style={{ background: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Ajustes necessários</label>
                                                        <textarea autoFocus className="form-input" style={{ minHeight: '80px', marginBottom: '8px' }} value={adjustmentText} onChange={e => setAdjustmentText(e.target.value)} />
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn" style={{ flex: 1, background: '#f59e0b', color: 'white' }} onClick={() => { onUpdateStatus(item.id, 'REJECTED', adjustmentText, currentViewVersion.versionNumber); setIsAdjustmentMode(false); onClose(); }}>Confirmar</button>
                                                            <button className="btn" style={{ background: '#eee' }} onClick={() => setIsAdjustmentMode(false)}>Sair</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        <button className="btn" style={{ background: '#10b981', color: 'white', fontWeight: 700 }} onClick={() => { onUpdateStatus(item.id, 'APPROVED'); onClose(); }}><CheckCircle size={16} /> Aprovar</button>
                                                        <button className="btn" style={{ border: '1px solid #f59e0b', color: '#f59e0b', fontWeight: 700 }} onClick={() => setIsAdjustmentMode(true)}><MessageSquare size={16} /> Solicitar ajustes</button>
                                                        <button className="btn" style={{ gridColumn: 'span 2', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 700 }} onClick={() => { onUpdateStatus(item.id, 'REJECTED_TOTAL'); onClose(); }}><XCircle size={16} /> Reprovação total</button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {userData?.uid === item.creatorId && (
                                            <button className="btn btn-primary" style={{ width: '100%', height: '44px' }} onClick={() => setShowVersionUpload(true)}><Layers size={18} /> Subir Nova Versão</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const ArtCard = ({ item, onClick, isGray }: { item: ArtApprovalItem, onClick: () => void, isGray?: boolean, [key: string]: any }) => {
    const postingDate = item.postingDate instanceof Timestamp ? item.postingDate.toDate() : new Date();
    return (
        <div className="glass-card" onClick={onClick} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', border: isGray ? '1px solid #e2e8f0' : '1px solid var(--border-color)', filter: isGray ? 'grayscale(1) opacity(0.5)' : 'none' }}>
            <div style={{ aspectRatio: '1/1', background: '#eee', position: 'relative' }}>
                <img src={item.files[0]?.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '100px', fontWeight: 800, backdropFilter: 'blur(4px)' }}>
                    V. {Number(item.currentVersion || 1).toFixed(1)}
                </div>
            </div>
            <div style={{ padding: '0.8rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: isGray ? '#64748b' : 'inherit' }}>{item.title}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{postingDate.toLocaleDateString('pt-BR')}</div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        VER HISTÓRICO <ChevronDown size={10} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const InstagramMockup = ({ company, media, caption, type, currentIndex, onIndexChange }: any) => {
    const isVertical = type === 'STORIES' || type === 'REELS';
    const aspectRatio = isVertical ? '9/16' : '4/5';
    const mediaList = Array.isArray(media) ? media : [media];
    return (
        <div style={{ width: '380px', background: 'white', borderRadius: '12px', border: '1px solid #efefef', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {company?.logoUrl ? <img src={company.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={16} color="#94a3b8" />}
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{company?.name || 'Marca'}</span>
            </div>
            <div style={{ width: '100%', background: '#000', aspectRatio: aspectRatio, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mediaList.length > 0 && <img src={mediaList[currentIndex]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                {mediaList.length > 1 && (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onIndexChange(Math.max(0, currentIndex - 1)); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer', zIndex: 10 }}><ChevronLeft size={20} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onIndexChange(Math.min(mediaList.length - 1, currentIndex + 1)); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer', zIndex: 10 }}><ChevronRight size={20} /></button>
                        <div style={{ position: 'absolute', bottom: '12px', width: '100%', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                            {mediaList.map((_: any, idx: number) => (
                                <div key={idx} style={{ width: '6px', height: '6px', borderRadius: '50%', background: idx === currentIndex ? 'white' : 'rgba(255,255,255,0.5)' }} />
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}><Heart size={24} /> <MessageCircle size={24} /> <Send size={24} /> <Bookmark size={24} style={{ marginLeft: 'auto' }} /></div>
                <div style={{ fontSize: '0.85rem' }}><strong>{company?.name || 'Marca'}</strong> {caption}</div>
            </div>
        </div>
    );
};

const FacebookMockup = ({ company, media, caption, type, currentIndex, onIndexChange }: any) => {
    const isVertical = type === 'STORIES' || type === 'REELS';
    const aspectRatio = isVertical ? '9/16' : '4/5';
    const mediaList = Array.isArray(media) ? media : [media];
    return (
        <div style={{ width: '480px', background: 'white', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eee', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {company?.logoUrl ? <img src={company.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={20} color="#94a3b8" />}
                </div>
                <div><div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{company?.name || 'Marca'}</div><div style={{ fontSize: '0.75rem', color: '#65676b' }}>Patrocinado · <Globe size={12} /></div></div>
            </div>
            <div style={{ padding: '12px', fontSize: '0.9rem' }}>{caption}</div>
            <div style={{ background: '#000', width: '100%', aspectRatio: aspectRatio, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {mediaList.length > 0 && <img src={mediaList[currentIndex]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                {mediaList.length > 1 && (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onIndexChange(Math.max(0, currentIndex - 1)); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer', zIndex: 10 }}><ChevronLeft size={20} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onIndexChange(Math.min(mediaList.length - 1, currentIndex + 1)); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer', zIndex: 10 }}><ChevronRight size={20} /></button>
                    </>
                )}
            </div>
        </div>
    );
};

const tabStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', padding: '0.45rem 1rem', border: 'none', background: active ? '#4318FF' : 'transparent', color: active ? 'white' : 'var(--text-muted)', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease'
});

export default ArtApprovalModule;
