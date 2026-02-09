
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { sendAdminNotification, AdminNotificationType } from '../services/NotificationService';
import {
    Mic,
    Send,
    History,
    AlertCircle,
    CheckCircle2,
    Clock,
    MessageSquare,
    AlertTriangle,
    Info,
    ChevronRight,
    Loader2,
    Play,
    Pause,
    User,
    Download,
    Sparkles
} from 'lucide-react';
import { generateAudio } from '../services/elevenLabsService';
import { uploadToR2 } from '../services/r2Service';
import { geminiService } from '../services/geminiService';

interface Locutor {
    id: string;
    name: string;
    avatarUrl: string;
    previewUrl: string;
    voiceId: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
}

const CHAR_LIMIT_PER_OFF = 534;

interface AudioRequest {
    id: string;
    text: string;
    charCount: number;
    slotsUsed: number;
    status: 'pending' | 'completed' | 'cancelled';
    audioUrl?: string;
    createdAt: any;
    companyId: string;
    userName: string;
    locutorName?: string;
}

const LocucoesModule: React.FC = () => {
    const { userData } = useAuth();
    const [text, setText] = useState('');
    const [requests, setRequests] = useState<AudioRequest[]>([]);
    const [locutores, setLocutores] = useState<Locutor[]>([]);
    const [selectedLocutor, setSelectedLocutor] = useState<Locutor | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companyCredits, setCompanyCredits] = useState(0);
    const [isMagicLoading, setIsMagicLoading] = useState(false);

    // Audio preview state
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audio] = useState(new Audio());

    // Calc stats
    const charCount = text.length;
    const slotsNeeded = Math.ceil(charCount / CHAR_LIMIT_PER_OFF) || 0;
    const hasEnoughCredits = slotsNeeded <= companyCredits;
    const canSubmit = text.trim().length > 0;

    useEffect(() => {
        // 1. Fetch locutores (Persistent, only depends on component mounting)
        const qLoc = query(collection(db, 'locutores'), where('isActive', '==', true));
        const unsubscribeLoc = onSnapshot(qLoc, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Locutor));
            // Client-side sort to avoid index requirement
            list.sort((a, b) => a.name.localeCompare(b.name));
            setLocutores(list);
            if (list.length > 0 && !selectedLocutor) {
                setSelectedLocutor(list[0]);
            }
        });

        // 2. Conditional listeners based on companyId
        let unsubscribeCompany = () => { };
        let unsubscribeRequests = () => { };

        if (userData?.companyId) {
            // Listen to company credits
            const companyRef = doc(db, 'companies', userData.companyId);
            unsubscribeCompany = onSnapshot(companyRef, (doc) => {
                if (doc.exists()) {
                    setCompanyCredits(doc.data().audioCredits || 0);
                }
            });

            const q = query(
                collection(db, 'audio_requests'),
                where('companyId', '==', userData.companyId),
                limit(50) // Reduced limit slightly to optimize client-side sort
            );

            unsubscribeRequests = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as AudioRequest));

                // Client-side sort to avoid index requirement
                list.sort((a, b) => {
                    const dateA = a.createdAt?.seconds || 0;
                    const dateB = b.createdAt?.seconds || 0;
                    return dateB - dateA;
                });

                setRequests(list);
                setLoading(false);
            }, (error) => {
                console.error("Erro na lista de pedidos:", error);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }

        return () => {
            unsubscribeLoc();
            unsubscribeCompany();
            unsubscribeRequests();
            audio.pause();
        };
    }, [userData?.companyId]);

    const togglePlay = (url: string | undefined, id: string) => {
        if (playingId === id) {
            audio.pause();
            setPlayingId(null);
        } else {
            if (!url) return;
            audio.src = url;
            audio.play().catch(err => {
                console.error("Erro ao reproduzir áudio:", err);
                setPlayingId(null);
            });
            setPlayingId(id);
            audio.onended = () => setPlayingId(null);
        }
    };

    const handleMagicRewrite = async () => {
        if (!text.trim() || isMagicLoading) return;

        setIsMagicLoading(true);
        try {
            const category = userData?.companyCategory || 'Varejo';
            const rewritten = await geminiService.rewriteForCategory(text, category);
            setText(rewritten);
        } catch (error) {
            console.error("Erro na magia da IA:", error);
            alert("Houve um probleminha ao invocar a magia da IA. Tente novamente!");
        } finally {
            setIsMagicLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!canSubmit || isSubmitting) return;

        if (!hasEnoughCredits) {
            alert(`Você não possui créditos suficientes. Necessário: ${slotsNeeded}, Disponível: ${companyCredits}`);
            return;
        }

        if (!selectedLocutor) {
            alert("Selecione um locutor.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (!userData?.companyId) {
                throw new Error("Sessão da empresa não encontrada. Tente recarregar a página.");
            }

            // 1. Double check balance
            const companyRef = doc(db, 'companies', userData.companyId);
            const compSnap = await getDoc(companyRef);
            if (!compSnap.exists()) throw new Error("Empresa não encontrada no banco de dados.");

            const currentCredits = compSnap.data().audioCredits || 0;
            if (currentCredits < slotsNeeded) {
                alert(`Créditos insuficientes. Recarregue a página ou solicite créditos. (Saldo: ${currentCredits})`);
                return;
            }

            // 2. GENERATE AUDIO via Eleven Labs
            const audioBlob = await generateAudio(
                text,
                selectedLocutor.voiceId,
                selectedLocutor.modelId,
                {
                    stability: selectedLocutor.stability ?? 0.5,
                    similarity_boost: selectedLocutor.similarityBoost ?? 0.75,
                    style: selectedLocutor.style ?? 0,
                    use_speaker_boost: selectedLocutor.useSpeakerBoost !== false
                }
            );

            // 3. UPLOAD to R2
            const audioFile = new File([audioBlob], `locucao_${Date.now()}.mp3`, { type: 'audio/mpeg' });
            const audioUrl = await uploadToR2(audioFile, `locucoes/${userData.companyId}`);

            // 4. Create the request as COMPLETED
            const requestData = {
                text,
                charCount,
                slotsNeeded,
                slotsUsed: slotsNeeded,
                status: 'completed',
                audioUrl,
                locutorId: selectedLocutor.id,
                locutorName: selectedLocutor.name,
                voiceId: selectedLocutor.voiceId,
                companyId: userData.companyId,
                companyName: userData.memberships?.find(m => m.companyId === userData?.companyId)?.companyName || 'N/A',
                userId: userData.uid,
                userName: userData.displayName || userData.name || 'Usuário',
                createdAt: serverTimestamp()
            };

            console.log('Salvando locução gerada:', requestData);
            await addDoc(collection(db, 'audio_requests'), requestData);

            // 5. Deduct credits
            await updateDoc(companyRef, {
                audioCredits: currentCredits - slotsNeeded
            });

            alert("Locução gerada com sucesso!");
            setText('');

            // Optional: play generated audio immediately
            const preview = new Audio(audioUrl);
            preview.play().catch(() => { });

        } catch (error: any) {
            console.error("Erro ao processar solicitação de áudio:", error);
            alert(`Erro ao processar áudio: ${error.message || 'Verifique sua conexão e se a chave da API (VITE_ELEVENLABS_API_KEY) está correta.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="module-container fade-in">
            <div className="module-header">
                <div>
                    <h2 className="module-title">Locuções</h2>
                    <p className="module-subtitle">Solicite a gravação de offs profissionais para sua empresa.</p>
                </div>

                <div className="glass-card" style={{
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: companyCredits > 0 ? 'rgba(67, 24, 255, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    border: companyCredits > 0 ? '1px solid rgba(67, 24, 255, 0.1)' : '1px solid rgba(239, 68, 68, 0.1)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: companyCredits > 0 ? 'var(--primary-color)' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Mic size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Créditos Disponíveis</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: companyCredits > 0 ? 'var(--text-color)' : '#ef4444' }}>
                            {companyCredits} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>offs</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="module-layout" style={{ gap: '2rem' }}>
                {/* Main Action Area */}
                <div className="module-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'transparent', padding: 0 }}>
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary-color)' }}>
                                <Mic size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>1. Escolha a Voz</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {locutores.map(loc => (
                                <div
                                    key={loc.id}
                                    onClick={() => setSelectedLocutor(loc)}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '1rem',
                                        borderRadius: '16px',
                                        border: selectedLocutor?.id === loc.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                        background: selectedLocutor?.id === loc.id ? 'var(--primary-light)' : 'rgba(0,0,0,0.02)',
                                        textAlign: 'center',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        margin: '0 auto 10px',
                                        overflow: 'hidden',
                                        background: '#eee',
                                        border: '2px solid white',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                                    }}>
                                        {loc.avatarUrl ? (
                                            <img src={loc.avatarUrl} alt={loc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                                <User size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{loc.name}</div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlay(loc.previewUrl, loc.id);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '5px',
                                            right: '5px',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: playingId === loc.id ? 'var(--primary-color)' : 'white',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: playingId === loc.id ? 'white' : 'var(--primary-color)',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {playingId === loc.id ? <Pause size={12} /> : <Play size={12} />}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary-color)' }}>
                                <MessageSquare size={20} />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>2. Texto para Locução</h3>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Digite aqui o texto que deseja que seja gravado..."
                                style={{
                                    width: '100%',
                                    height: '240px',
                                    padding: '1.2rem',
                                    borderRadius: '16px',
                                    border: '2px solid var(--border-color)',
                                    background: 'rgba(255,255,255,0.5)',
                                    fontSize: '1rem',
                                    fontFamily: 'inherit',
                                    resize: 'none',
                                    transition: 'all 0.3s',
                                    outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                            />

                            <div style={{
                                position: 'absolute',
                                bottom: '15px',
                                right: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: charCount > CHAR_LIMIT_PER_OFF * 2 ? '#ef4444' : 'var(--text-secondary)',
                                    background: 'white',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                                }}>
                                    {charCount} caracteres
                                </div>
                                <button
                                    onClick={handleMagicRewrite}
                                    disabled={isMagicLoading || !text.trim()}
                                    title={`Ajustar texto para ${userData?.companyCategory || 'sua categoria'}`}
                                    style={{
                                        background: 'linear-gradient(135deg, #4318FF 0%, #83EAF1 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '20px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(67, 24, 255, 0.2)',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                >
                                    {isMagicLoading ? (
                                        <Loader2 className="loading-spinner" size={14} />
                                    ) : (
                                        <Sparkles size={14} />
                                    )}
                                    Magia da IA {userData?.companyCategory ? `(${userData.companyCategory})` : ''}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                            <div className="glass-card" style={{ padding: '1rem', border: '1px dashed var(--border-color)', background: 'rgba(0,0,0,0.01)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                                    <Info size={14} />
                                    CÁLCULO DE CRÉDITO
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                    {slotsNeeded} {slotsNeeded === 1 ? 'crédito' : 'créditos'} necessários
                                </div>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit || isSubmitting}
                                className="btn btn-primary"
                                style={{
                                    height: 'auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    borderRadius: '16px'
                                }}
                            >
                                {isSubmitting ? <Loader2 className="loading-spinner" /> : <Send size={20} />}
                                Solicitar Gravação
                            </button>
                        </div>

                        {text.length > 0 && slotsNeeded > companyCredits && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}>
                                <AlertTriangle size={18} />
                                Você não possui créditos suficientes para este tamanho de texto.
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            💡 <strong>Dica:</strong> Mantenha o texto objetivo. Cada off suporta até 534 caracteres.
                            Textos maiores consumirão créditos adicionais automaticamente.
                        </div>
                    </div>
                </div>

                {/* Sidebar History Area */}
                <div className="module-sidebar" style={{ width: '400px' }}>
                    <div className="glass-card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                            <History size={20} color="var(--primary-color)" />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Últimas Solicitações</h3>
                        </div>

                        {loading ? (
                            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="loading-spinner" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5, textAlign: 'center' }}>
                                <Mic size={40} style={{ marginBottom: '1rem' }} />
                                <p>Nenhuma solicitação encontrada.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                                {requests.map((req) => (
                                    <div key={req.id} className="history-item" style={{
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.4)',
                                        border: '1px solid var(--border-color)',
                                        transition: 'all 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: req.status === 'completed' ? '#f0fdf4' : req.status === 'pending' ? '#fffbeb' : '#fef2f2',
                                                    color: req.status === 'completed' ? '#166534' : req.status === 'pending' ? '#92400e' : '#991b1b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    width: 'fit-content'
                                                }}>
                                                    {req.status === 'completed' ? <CheckCircle2 size={12} /> :
                                                        req.status === 'pending' ? <Clock size={12} /> : <AlertCircle size={12} />}
                                                    {req.status === 'completed' ? 'Concluído' :
                                                        req.status === 'pending' ? 'Em Fila' : 'Cancelado'}
                                                </div>
                                                {(req as any).locutorName && (
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 700, marginLeft: '4px' }}>
                                                        🎙️ {(req as any).locutorName}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Agora'}
                                            </span>
                                        </div>

                                        <p style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-color)',
                                            margin: '8px 0',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            lineHeight: '1.4'
                                        }}>
                                            {req.text}
                                        </p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {req.slotsUsed} {req.slotsUsed === 1 ? 'crédito' : 'créditos'}
                                            </span>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {req.audioUrl && (
                                                    <>
                                                        <button
                                                            onClick={() => togglePlay(req.audioUrl, req.id)}
                                                            className="btn-icon"
                                                            style={{
                                                                padding: '6px',
                                                                background: playingId === req.id ? 'var(--primary-color)' : 'var(--primary-light)',
                                                                color: playingId === req.id ? 'white' : 'var(--primary-color)',
                                                                borderRadius: '8px'
                                                            }}
                                                        >
                                                            {playingId === req.id ? <Pause size={16} /> : <Play size={16} />}
                                                        </button>
                                                        <a
                                                            href={req.audioUrl}
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn-icon"
                                                            style={{ padding: '6px', color: 'var(--text-secondary)' }}
                                                        >
                                                            <Download size={16} />
                                                        </a>
                                                    </>
                                                )}
                                                <button className="btn-icon" style={{ padding: '4px' }}>
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .module-container { padding: 2rem; }
                .module-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .module-title { font-size: 2rem; font-weight: 800; color: var(--text-color); margin: 0; }
                .module-subtitle { color: var(--text-secondary); margin-top: 0.5rem; }
                .history-item:hover { transform: translateX(5px); border-color: var(--primary-color) !important; background: white !important; }
            `}</style>
        </div>
    );
};

export default LocucoesModule;
