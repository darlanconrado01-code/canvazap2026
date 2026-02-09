
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    where,
    getDocs
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Video,
    Plus,
    Edit,
    Trash2,
    Play,
    X,
    Loader2,
    CheckSquare,
    Square,
    ExternalLink,
    ChevronLeft,
    Search
} from 'lucide-react';

interface Tutorial {
    id: string;
    title: string;
    description: string;
    youtubeUrl: string;
    allowedCompanyIds: string[];
    createdAt: any;
}

interface Company {
    id: string;
    name: string;
}

const TutorialsModule: React.FC = () => {
    const { userData } = useAuth();
    const isSuperAdmin = userData?.role === 'super_admin';

    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!userData) return;

        // Fetch Tutorials
        let q;
        if (isSuperAdmin) {
            q = query(collection(db, 'tutorials'));
        } else {
            // For regular users, we fetch videos that allow their companyId
            // OR where allowedCompanyIds contains '*' (for all companies)
            // But Firestore array-contains doesn't support OR naturally 
            // Better to fetch and filter client-side if the list is small, 
            // or use specific filters.
            q = query(collection(db, 'tutorials'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tutorial));

            if (!isSuperAdmin) {
                // Filter tutorials for current user's company
                list = list.filter(t =>
                    t.allowedCompanyIds.includes('*') ||
                    t.allowedCompanyIds.includes(userData.companyId || '')
                );
            }

            // Sort by title
            list.sort((a, b) => a.title.localeCompare(b.title));
            setTutorials(list);
            setLoading(false);
        });

        // If Super Admin, also fetch companies for the selector
        if (isSuperAdmin) {
            const fetchCompanies = async () => {
                const snap = await getDocs(collection(db, 'companies'));
                const list = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
                list.sort((a, b) => a.name.localeCompare(b.name));
                setCompanies(list);
            };
            fetchCompanies();
        }

        return () => unsubscribe();
    }, [userData, isSuperAdmin]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !youtubeUrl) return alert("Título e URL são obrigatórios");

        setIsSaving(true);
        try {
            const id = editId || `tut_${Date.now()}`;
            const data = {
                title,
                description,
                youtubeUrl,
                allowedCompanyIds: selectedCompanyIds,
                updatedAt: serverTimestamp(),
            };

            if (!editId) {
                (data as any).createdAt = serverTimestamp();
            }

            await setDoc(doc(db, 'tutorials', id), data, { merge: true });
            setView('list');
            resetForm();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar tutorial");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este tutorial?")) return;
        try {
            await deleteDoc(doc(db, 'tutorials', id));
        } catch (error) {
            alert("Erro ao excluir");
        }
    };

    const handleEdit = (tut: Tutorial) => {
        setEditId(tut.id);
        setTitle(tut.title);
        setDescription(tut.description);
        setYoutubeUrl(tut.youtubeUrl);
        setSelectedCompanyIds(tut.allowedCompanyIds || []);
        setView('form');
    };

    const resetForm = () => {
        setEditId(null);
        setTitle('');
        setDescription('');
        setYoutubeUrl('');
        setSelectedCompanyIds([]);
    };

    const toggleCompanySelection = (cid: string) => {
        if (cid === '*') {
            setSelectedCompanyIds(prev => prev.includes('*') ? [] : ['*']);
            return;
        }

        setSelectedCompanyIds(prev => {
            const filtered = prev.filter(id => id !== '*');
            if (filtered.includes(cid)) {
                return filtered.filter(id => id !== cid);
            } else {
                return [...filtered, cid];
            }
        });
    };

    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '400px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="loading-spinner" size={40} />
            </div>
        );
    }

    // FORM VIEW (Super Admin Only)
    if (view === 'form' && isSuperAdmin) {
        return (
            <div className="module-container fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => { setView('list'); resetForm(); }} className="btn-icon">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="title">{editId ? 'Editar Tutorial' : 'Novo Tutorial'}</h2>
                </div>

                <div className="glass-card" style={{ maxWidth: '800px', padding: '2rem' }}>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Título do Vídeo</label>
                            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Como criar sua primeira lâmina" required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Descrição</label>
                            <textarea className="form-input" style={{ height: '100px' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve resumo do que é ensinado no vídeo" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">URL do Youtube</label>
                            <input className="form-input" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="Ex: https://www.youtube.com/watch?v=..." required />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Liberar para Empresas</span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{selectedCompanyIds.includes('*') ? 'Todos' : `${selectedCompanyIds.length} selecionadas`}</span>
                            </label>

                            <div style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '1rem',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                background: 'rgba(255,255,255,0.3)'
                            }}>
                                <div
                                    onClick={() => toggleCompanySelection('*')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', fontWeight: 700 }}
                                >
                                    {selectedCompanyIds.includes('*') ? <CheckSquare size={18} color="var(--primary-color)" /> : <Square size={18} />}
                                    LIBERAR PARA TODOS (*)
                                </div>

                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                    <input
                                        type="text"
                                        placeholder="Filtrar empresas..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                    />
                                </div>

                                {companies
                                    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(comp => (
                                        <div
                                            key={comp.id}
                                            onClick={() => toggleCompanySelection(comp.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', opacity: selectedCompanyIds.includes('*') ? 0.4 : 1 }}
                                        >
                                            {(selectedCompanyIds.includes(comp.id) || selectedCompanyIds.includes('*'))
                                                ? <CheckSquare size={18} color="var(--primary-color)" />
                                                : <Square size={18} />}
                                            <span style={{ fontSize: '0.9rem' }}>{comp.name}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={isSaving}>
                            {isSaving ? <Loader2 className="loading-spinner" /> : 'Salvar Tutorial'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="module-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 className="title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Video size={28} /> Tutoriais e Guia de Uso
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Assista aos vídeos para aprender a usar as ferramentas da plataforma.</p>
                </div>
                {isSuperAdmin && (
                    <button onClick={() => { resetForm(); setView('form'); }} className="btn btn-primary" style={{ width: 'auto' }}>
                        <Plus size={20} /> Adicionar Vídeo
                    </button>
                )}
            </div>

            {tutorials.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.6 }}>
                    <Video size={48} style={{ margin: '0 auto 1rem' }} />
                    <p>Nenhum tutorial disponível no momento.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {tutorials.map((tut) => (
                        <div key={tut.id} className="glass-card hover-scale" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
                            <div
                                onClick={() => setSelectedVideo(tut)}
                                style={{
                                    width: '100%',
                                    aspectRatio: '16/9',
                                    background: '#000',
                                    borderRadius: '12px',
                                    marginBottom: '1rem',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    overflow: 'hidden'
                                }}
                            >
                                <img
                                    src={`https://img.youtube.com/vi/${getYoutubeId(tut.youtubeUrl)}/mqdefault.jpg`}
                                    alt={tut.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                                />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(67, 24, 255, 0.8)', color: 'white', padding: '12px', borderRadius: '50%' }}>
                                    <Play fill="white" size={24} />
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem' }}>{tut.title}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1, marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                {tut.description}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setSelectedVideo(tut)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        Assistir Agora <ExternalLink size={14} />
                                    </button>
                                </div>

                                {isSuperAdmin && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => handleEdit(tut)} className="btn-icon" style={{ padding: '6px' }}><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(tut.id)} className="btn-icon" style={{ padding: '6px', color: '#ef4444' }}><Trash2 size={16} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Video Player Modal */}
            {selectedVideo && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '2rem'
                }} onClick={() => setSelectedVideo(null)}>
                    <div
                        style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white' }}>
                            <h3 style={{ margin: 0 }}>{selectedVideo.title}</h3>
                            <button onClick={() => setSelectedVideo(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '16px', overflow: 'hidden', background: '#000', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${getYoutubeId(selectedVideo.youtubeUrl)}?autoplay=1`}
                                title={selectedVideo.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: '1.6' }}>{selectedVideo.description}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TutorialsModule;
