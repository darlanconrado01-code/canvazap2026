
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { uploadToR2 } from '../services/r2Service';
import {
    Mic,
    Plus,
    Edit,
    Trash2,
    Play,
    Pause,
    Upload,
    Loader2,
    X,
    User,
    Settings,
    Music,
    Globe,
    FlaskConical,
    ChevronDown,
    ArrowLeft,
    CheckCircle2,
    Volume2
} from 'lucide-react';

interface Locutor {
    id: string;
    name: string;
    internalName: string;
    voiceId: string;
    avatarUrl: string;
    previewUrl: string;
    isActive: boolean;
    // Advanced Eleven Labs Settings
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    createdAt: any;
}

const AdminLocutoresModule: React.FC = () => {
    const { userData } = useAuth();
    const [locutores, setLocutores] = useState<Locutor[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingLocutor, setEditingLocutor] = useState<Locutor | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [internalName, setInternalName] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Advanced Settings State
    const [modelId, setModelId] = useState('eleven_multilingual_v2');
    const [stability, setStability] = useState(0.5);
    const [similarityBoost, setSimilarityBoost] = useState(0.75);
    const [style, setStyle] = useState(0);
    const [useSpeakerBoost, setUseSpeakerBoost] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Audio Playback State
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audio] = useState(new Audio());

    useEffect(() => {
        if (userData?.role !== 'super_admin') return;

        const q = query(collection(db, 'locutores'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Locutor));
            setLocutores(list);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            audio.pause();
        };
    }, [userData]);

    const handleEnterForm = (locutor: Locutor | null = null) => {
        if (locutor) {
            setEditingLocutor(locutor);
            setName(locutor.name);
            setInternalName(locutor.internalName);
            setVoiceId(locutor.voiceId);
            setAvatarUrl(locutor.avatarUrl);
            setPreviewUrl(locutor.previewUrl || '');
            setIsActive(locutor.isActive !== false);
            setModelId(locutor.modelId || 'eleven_multilingual_v2');
            setStability(locutor.stability ?? 0.5);
            setSimilarityBoost(locutor.similarityBoost ?? 0.75);
            setStyle(locutor.style ?? 0);
            setUseSpeakerBoost(locutor.useSpeakerBoost !== false);
        } else {
            setEditingLocutor(null);
            setName('');
            setInternalName('');
            setVoiceId('');
            setAvatarUrl('');
            setPreviewUrl('');
            setIsActive(true);
            setModelId('eleven_multilingual_v2');
            setStability(0.5);
            setSimilarityBoost(0.75);
            setStyle(0);
            setUseSpeakerBoost(true);
        }
        setShowAdvanced(false);
        setView('form');
        window.scrollTo(0, 0);
    };

    const handleSave = async (e?: any) => {
        if (e) e.preventDefault();

        if (!name.trim() || !internalName.trim() || !voiceId.trim()) {
            alert('Por favor, preencha todos os campos obrigatórios (Nome, Nome Interno e Voice ID).');
            return;
        }

        setActionLoading(true);
        try {
            const id = editingLocutor?.id || `locutor_${Date.now()}`;
            const locutorData: any = {
                name: name.trim(),
                internalName: internalName.trim(),
                voiceId: voiceId.trim(),
                avatarUrl: avatarUrl || '',
                previewUrl: previewUrl || '',
                isActive,
                modelId,
                stability,
                similarityBoost,
                style,
                useSpeakerBoost,
                updatedAt: serverTimestamp(),
            };

            if (!editingLocutor) {
                locutorData.createdAt = serverTimestamp();
            }

            console.log('Tentando salvar locutor:', id, locutorData);
            await setDoc(doc(db, 'locutores', id), locutorData, { merge: true });

            setView('list');
            alert('Locutor salvo com sucesso!');
        } catch (error: any) {
            console.error('Erro detalhado ao salvar locutor:', error);
            alert(`Erro ao salvar locutor: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este locutor?')) return;
        try {
            await deleteDoc(doc(db, 'locutores', id));
        } catch (error) {
            console.error(error);
            alert('Erro ao excluir');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'preview') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setActionLoading(true);
        try {
            const folder = type === 'avatar' ? 'locutores/avatars' : 'locutores/previews';
            const url = await uploadToR2(file, folder);
            if (type === 'avatar') setAvatarUrl(url);
            else setPreviewUrl(url);
        } catch (error) {
            console.error(error);
            alert('Erro no upload');
        } finally {
            setActionLoading(false);
        }
    };

    const togglePlay = (locutor: Locutor) => {
        if (playingId === locutor.id) {
            audio.pause();
            setPlayingId(null);
        } else {
            if (!locutor.previewUrl) return alert('Sem prévia disponível');
            audio.src = locutor.previewUrl;
            audio.play().catch(err => {
                console.error("Erro ao reproduzir áudio:", err);
                alert("Erro ao reproduzir áudio. Verifique se o link é válido.");
                setPlayingId(null);
            });
            setPlayingId(locutor.id);
            audio.onended = () => setPlayingId(null);
        }
    };

    if (userData?.role !== 'super_admin') {
        return <div className="p-8">Acesso restrito.</div>;
    }

    // LIST VIEW
    if (view === 'list') {
        return (
            <div className="fade-in p-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 className="title" style={{ fontSize: '1.8rem' }}>Banco de Vozes 🎙️</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Gerencie as vozes dos seus locutores cadastrados.</p>
                    </div>
                    <button
                        onClick={() => handleEnterForm()}
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={20} /> Adicionar Novo Locutor
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <Loader2 className="loading-spinner" size={40} />
                    </div>
                ) : locutores.length === 0 ? (
                    <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                        <Mic size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Nenhum locutor cadastrado.</p>
                        <button onClick={() => handleEnterForm()} className="btn btn-primary" style={{ width: 'auto', marginTop: '1rem' }}>Começar agora</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        {locutores.map((loc) => (
                            <div key={loc.id} className="glass-card fade-in hover-scale" style={{ padding: '1.5rem', position: 'relative', border: '1px solid var(--border-color)', background: loc.isActive ? 'white' : 'rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        background: '#f0f0f0',
                                        overflow: 'hidden',
                                        border: loc.isActive ? '2px solid var(--primary-color)' : '2px solid #ccc',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                    }}>
                                        {loc.avatarUrl ? (
                                            <img src={loc.avatarUrl} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                                <User size={32} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{loc.name}</h3>
                                            {loc.isActive && <div style={{ color: '#10b981' }} title="Ativo"><CheckCircle2 size={14} /></div>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{loc.internalName}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            <Globe size={12} />
                                            <span>{loc.voiceId}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button
                                        onClick={() => togglePlay(loc)}
                                        className="btn-secondary"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: playingId === loc.id ? 'var(--primary-light)' : 'rgba(0,0,0,0.03)' }}
                                    >
                                        {playingId === loc.id ? <Pause size={18} /> : <Play size={18} />}
                                        Ouvir Prévia
                                    </button>
                                    <button onClick={() => handleEnterForm(loc)} className="btn-secondary" style={{ width: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(loc.id)} className="btn-secondary" style={{ width: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // FORM VIEW (PAGE STYLE)
    return (
        <div className="fade-in p-2">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setView('list')}
                        style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-color)' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>{editingLocutor ? `Editando: ${editingLocutor.name}` : 'Novo Locutor'}</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Preencha os dados e configure a voz para IA.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => setView('list')} style={{ width: 'auto', padding: '0.6rem 1.5rem' }}>Cancelar</button>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary"
                        disabled={actionLoading}
                        style={{ width: 'auto', padding: '0.6rem 2rem', fontWeight: 700 }}
                    >
                        {actionLoading ? <Loader2 className="loading-spinner" /> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
                {/* Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Basic Info Section */}
                    <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <User size={20} color="var(--primary-color)" />
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>INFORMAÇÕES BÁSICAS</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Nome na Vitrine (Cliente vê)</label>
                                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rodrigo Freitas" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Nome Interno (Somente Admin)</label>
                                <input className="form-input" value={internalName} onChange={e => setInternalName(e.target.value)} placeholder="Ex: Locutor_Rodrigo_Habilitado" required />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Eleven Labs Voice ID</label>
                            <div style={{ position: 'relative' }}>
                                <Globe size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--primary-color)' }} />
                                <input className="form-input" style={{ paddingLeft: '2.5rem' }} value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="Ex: pms8D22... (cole o ID aqui)" required />
                            </div>
                        </div>
                    </div>

                    {/* Assets Section */}
                    <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <Volume2 size={20} color="var(--primary-color)" />
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>ARQUIVOS E MÍDIA</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Foto do Perfil (URL)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input className="form-input" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="Copie a URL ou clique no botão" />
                                    <button type="button" onClick={() => (document.getElementById('file-avatar') as any).click()} className="btn-icon" style={{ height: '42px', width: '42px', minWidth: '42px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                        <Upload size={18} />
                                        <input type="file" id="file-avatar" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'avatar')} />
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Áudio de Exemplo / Prévia (URL)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input className="form-input" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} placeholder="Arquivo .mp3 ou .wav" />
                                    <button type="button" onClick={() => (document.getElementById('file-preview') as any).click()} className="btn-icon" style={{ height: '42px', width: '42px', minWidth: '42px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                        <Music size={18} />
                                        <input type="file" id="file-preview" accept="audio/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'preview')} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Config Section */}
                    <div className="glass-card" style={{ padding: '2rem', background: 'rgba(67, 24, 255, 0.02)', border: '1px solid rgba(67, 24, 255, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <FlaskConical size={20} color="var(--primary-color)" />
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>CONFIGURAÇÕES DE IA (ELEVEN LABS)</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', padding: '6px 14px', borderRadius: '30px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} checked={useSpeakerBoost} onChange={e => setUseSpeakerBoost(e.target.checked)} id="useSpeakerBoost" />
                                <label htmlFor="useSpeakerBoost" style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-color)', cursor: 'pointer' }}>Speaker Boost Habilitado</label>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.75rem' }}>ID do Modelo de Síntese</label>
                            <select className="form-input" value={modelId} onChange={e => setModelId(e.target.value)} style={{ borderRadius: '12px' }}>
                                <option value="eleven_multilingual_v2">Multilingual v2 (Ideal para Português - Maior Qualidade)</option>
                                <option value="eleven_turbo_v2_5">Turbo v2.5 (Baixa latência - Velocidade Máxima)</option>
                                <option value="eleven_monolingual_v1">Monolingual v1 (Inglês apenas)</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>Estabilidade (Stability)</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>{Math.round(stability * 100)}%</span>
                                </div>
                                <input type="range" className="slider" min="0" max="1" step="0.01" value={stability} onChange={e => setStability(Number(e.target.value))} style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                                    <span>EMOTIVA / VARIÁVEL</span>
                                    <span>ESTÁVEL / CONSTANTE</span>
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>Clareza / Semelhança</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>{Math.round(similarityBoost * 100)}%</span>
                                </div>
                                <input type="range" className="slider" min="0" max="1" step="0.01" value={similarityBoost} onChange={e => setSimilarityBoost(Number(e.target.value))} style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
                                    <span>MAIS NATURAL</span>
                                    <span>FIEL À VOZ ORIGINAL</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>Exagero de Estilo (Style Exaggeration)</label>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>{Math.round(style * 100)}%</span>
                            </div>
                            <input type="range" className="slider" min="0" max="1" step="0.01" value={style} onChange={e => setStyle(Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                    </div>
                </div>

                {/* Sidebar Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '1rem' }}>
                    <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            margin: '0 auto 1.5rem',
                            overflow: 'hidden',
                            border: '4px solid white',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            background: '#f0f0f0'
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Voz" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                    <User size={60} />
                                </div>
                            )}
                        </div>
                        <h3 style={{ margin: '0 0 5px', fontSize: '1.1rem', fontWeight: 800 }}>{name || 'Nome do Locutor'}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{internalName || 'ID Interno'}</p>

                        <div style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            borderRadius: '12px',
                            background: isActive ? '#f0fdf4' : '#fef2f2',
                            color: isActive ? '#10b981' : '#ef4444',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}>
                            {isActive ? <CheckCircle2 size={16} /> : <X size={16} />}
                            {isActive ? 'HABILITADO' : 'DESABILITADO'}
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tornar Visível?</span>
                            </label>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>TESTAR ÁUDIO ATUAL</h4>
                        <button
                            type="button"
                            onClick={() => playingId === 'preview' ? (audio.pause(), setPlayingId(null)) : togglePlay({ id: 'preview', previewUrl } as any)}
                            disabled={!previewUrl}
                            className="btn-secondary"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '48px', opacity: previewUrl ? 1 : 0.5 }}
                        >
                            {playingId === 'preview' ? <Pause size={20} /> : <Play size={20} />}
                            Ouvir Gravação
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .slider {
                    -webkit-appearance: none;
                    background: #e2e8f0;
                    border-radius: 10px;
                    height: 8px;
                    outline: none;
                    transition: 0.2s;
                    width: 100%;
                }
                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    background: var(--primary-color);
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(67, 24, 255, 0.3);
                    border: 3px solid white;
                }
                .slider::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    background: var(--primary-color);
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(67, 24, 255, 0.3);
                    border: 3px solid white;
                }
                .form-input:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 4px rgba(67, 24, 255, 0.1);
                }
                .hover-scale { transition: transform 0.2s; }
                .hover-scale:hover { transform: translateY(-3px); border-color: var(--primary-color) !important; }
            `}</style>
        </div>
    );
};

export default AdminLocutoresModule;
