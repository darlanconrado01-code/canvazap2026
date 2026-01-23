
import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    getDoc,
    query,
    orderBy
} from 'firebase/firestore';
import {
    Download,
    Plus,
    Trash2,
    Type,
    MapPin,
    MessageSquare,
    ChevronUp,
    ChevronDown,
    Save,
    Image as ImageIcon,
    Clock,
    Briefcase,
    Settings,
    Mail,
    Search,
    Filter
} from 'lucide-react';

const JobVacancyModule = () => {
    const { userData } = useAuth();
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingBg, setIsSavingBg] = useState(false);

    // --- Templates State ---
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

    // --- Background State (Company Specific) ---
    const [bgUrl, setBgUrl] = useState('https://i.imgur.com/1XwMCiv.png');
    const [companyDefaultBg, setCompanyDefaultBg] = useState('https://i.imgur.com/1XwMCiv.png');

    // --- Content State ---
    const [vaga, setVaga] = useState('Analista de Vendas');
    const [localidade, setLocalidade] = useState('Belém');
    const [contatoTipo, setContatoTipo] = useState<'whatsapp' | 'email'>('whatsapp');
    const [contatoTexto, setContatoTexto] = useState('Interessados enviar currículo para o WhatsApp:');
    const [contatoWhatsapp, setContatoWhatsapp] = useState('(91) 98404-7050');
    const [contatoEmail, setContatoEmail] = useState('vagas.colina@gmail.com');
    const [filterVaga, setFilterVaga] = useState('');
    const [filterCidade, setFilterCidade] = useState('');

    const [secoes, setSecoes] = useState([
        {
            id: '1',
            titulo: 'Requisitos',
            itens: 'Ensino superior em administração ou áreas correlatas;\nHabilidade com controles internos;\nExcel intermediário ao avançado;\nHabilidade com sistema Wintor.'
        },
        {
            id: '2',
            titulo: 'Diferencial',
            itens: 'Ter atuado com controles internos da área comercial em distribuidora.'
        }
    ]);

    const [fontSizes, setFontSizes] = useState<any>({
        vaga: 82,
        localidade: 42,
        contato: 32,
        secaoTitulos: { '1': 32, '2': 32 },
        secaoListas: { '1': 28, '2': 28 }
    });

    // --- Load Background and Templates ---
    useEffect(() => {
        if (!userData?.companyId) return;

        // Load Company BG
        const loadBg = async () => {
            try {
                const companyRef = doc(db, 'companies', userData.companyId);
                const companySnap = await getDoc(companyRef);
                if (companySnap.exists()) {
                    const data = companySnap.data();
                    if (data.jobVacancyBackground) {
                        setBgUrl(data.jobVacancyBackground);
                        setCompanyDefaultBg(data.jobVacancyBackground);
                    }
                }
            } catch (e) {
                console.error("Error loading BG:", e);
            }
        };
        loadBg();

        // Load Templates
        const q = query(
            collection(db, 'companies', userData.companyId, 'jobTemplates'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const temps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTemplates(temps);
        });

        return () => unsubscribe();
    }, [userData?.companyId]);

    // --- Actions ---
    const handleFontSize = (key: string, id: string | null, action: 'increase' | 'decrease') => {
        const step = 2;
        const min = 8;

        setFontSizes((prev: any) => {
            const newState = { ...prev };
            if (id) {
                const sectionKey = key as 'secaoTitulos' | 'secaoListas';
                const current = (prev[sectionKey] && prev[sectionKey][id]) || (key === 'secaoTitulos' ? 32 : 28);
                const next = action === 'increase' ? current + step : Math.max(min, current - step);
                newState[sectionKey] = { ...prev[sectionKey], [id]: next };
            } else {
                const current = prev[key];
                const next = action === 'increase' ? current + step : Math.max(min, current - step);
                newState[key] = next;
            }
            return newState;
        });
    };

    const addSecao = () => {
        const id = Date.now().toString();
        setSecoes([...secoes, { id, titulo: 'Nova Seção', itens: '' }]);
        setFontSizes((prev: any) => ({
            ...prev,
            secaoTitulos: { ...prev.secaoTitulos, [id]: 32 },
            secaoListas: { ...prev.secaoListas, [id]: 28 }
        }));
    };

    const removeSecao = (id: string) => {
        setSecoes(secoes.filter(s => s.id !== id));
    };

    const updateSecao = (id: string, field: 'titulo' | 'itens', value: string) => {
        setSecoes(secoes.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleDownload = async () => {
        if (!previewRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(previewRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                logging: false,
            });
            const link = document.createElement('a');
            link.download = `${vaga.trim().replace(/\s+/g, '_') || 'vaga'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error(error);
            alert('Erro ao gerar imagem.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveTemplate = async (asNew: boolean = false) => {
        if (!userData?.companyId) return;
        setIsSaving(true);
        try {
            const data = {
                vaga,
                localidade,
                contatoTipo,
                contatoTexto,
                contatoWhatsapp,
                contatoEmail,
                bgUrl,
                secoes,
                fontSizes,
                updatedAt: serverTimestamp()
            };

            if (selectedTemplateId && !asNew) {
                await setDoc(doc(db, 'companies', userData.companyId, 'jobTemplates', selectedTemplateId), data, { merge: true });
                alert("Alterações salvas com sucesso!");
            } else {
                const docRef = await addDoc(collection(db, 'companies', userData.companyId, 'jobTemplates'), data);
                setSelectedTemplateId(docRef.id);
                alert("Nova vaga salva no histórico!");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBg = async () => {
        if (!userData?.companyId) return;
        setIsSavingBg(true);
        try {
            const companyRef = doc(db, 'companies', userData.companyId);
            await setDoc(companyRef, {
                jobVacancyBackground: bgUrl
            }, { merge: true });
            setCompanyDefaultBg(bgUrl);
            alert("Fundo padrão atualizado para sua empresa!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar fundo.");
        } finally {
            setIsSavingBg(false);
        }
    };

    const loadTemplate = (temp: any) => {
        setSelectedTemplateId(temp.id);
        setVaga(temp.vaga || '');
        setLocalidade(temp.localidade || '');
        setContatoTipo(temp.contatoTipo || 'whatsapp');
        setContatoTexto(temp.contatoTexto || '');
        setContatoWhatsapp(temp.contatoWhatsapp || '');
        setContatoEmail(temp.contatoEmail || '');
        setBgUrl(temp.bgUrl || companyDefaultBg);
        setSecoes(temp.secoes || []);
        setFontSizes(temp.fontSizes || {
            vaga: 82,
            localidade: 42,
            contato: 32,
            secaoTitulos: {},
            secaoListas: {}
        });
    };

    const deleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userData?.companyId || !confirm("Deseja excluir este registro?")) return;
        try {
            await deleteDoc(doc(db, 'companies', userData.companyId, 'jobTemplates', id));
            if (selectedTemplateId === id) setSelectedTemplateId(null);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="fade-in" style={{ padding: '0 2rem 2rem 2rem' }}>
            {/* Header Banner */}
            <div className="banner-premium" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="title" style={{ color: 'white', margin: 0, fontSize: '1.8rem' }}>Artes Vagas</h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0.2rem 0 0 0' }}>Gestão personalizada de recrutamento</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleSaveTemplate(false)}
                        disabled={isSaving}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            color: 'white',
                            borderColor: 'rgba(255,255,255,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isSaving ? <div className="loading-spinner" style={{ width: 14, height: 14 }} /> : <Save size={18} />}
                        {selectedTemplateId ? 'Atualizar Atual' : 'Salvar Nova'}
                    </button>
                    {selectedTemplateId && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleSaveTemplate(true)}
                            disabled={isSaving}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                borderColor: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Plus size={18} /> Salvar como Nova
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleDownload}
                        disabled={isGenerating}
                        style={{
                            background: 'white',
                            color: 'var(--primary-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                    >
                        {isGenerating ? (
                            <div className="loading-spinner" style={{ width: '18px', height: '18px', borderTopColor: 'var(--primary-color)' }}></div>
                        ) : (
                            <Download size={18} />
                        )}
                        {isGenerating ? 'Gerando...' : 'Baixar Arte'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 540px 320px', gap: '2rem', alignItems: 'start' }}>

                {/* 1. LEFT: EDITOR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Background Settings Card */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Settings size={18} className="text-primary" />
                            Tema e Fundo
                        </h3>
                        <div className="campo-grupo">
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>URL da Imagem de Fundo</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={bgUrl}
                                    placeholder="Ex: https://..."
                                    onChange={(e) => setBgUrl(e.target.value)}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleSaveBg}
                                    disabled={isSavingBg}
                                    style={{ padding: '0 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    {isSavingBg ? 'Salvando...' : 'Fixar Tema'}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>* Este fundo será salvo como padrão para todas as artes da sua empresa.</p>
                        </div>
                    </div>

                    {/* Main Info Card */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Briefcase size={18} className="text-primary" />
                            Definições da Vaga
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="campo-grupo">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>VAGA (Cargo)</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={vaga}
                                        placeholder="Ex: Gerente Comercial"
                                        onChange={(e) => setVaga(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button onClick={() => handleFontSize('vaga', null, 'increase')} className="btn-icon-mini"><ChevronUp size={14} /></button>
                                        <button onClick={() => handleFontSize('vaga', null, 'decrease')} className="btn-icon-mini"><ChevronDown size={14} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="campo-grupo">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Cidade</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={localidade}
                                        placeholder="Ex: Belém - PA"
                                        onChange={(e) => setLocalidade(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button onClick={() => handleFontSize('localidade', null, 'increase')} className="btn-icon-mini"><ChevronUp size={14} /></button>
                                        <button onClick={() => handleFontSize('localidade', null, 'decrease')} className="btn-icon-mini"><ChevronDown size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Sections Card */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h3 className="title" style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ImageIcon size={18} className="text-primary" />
                                Requisitos e Diferenciais
                            </h3>
                            <button className="btn btn-secondary" onClick={addSecao} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
                                <Plus size={14} /> Adicionar Grupo
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {secoes.map((secao) => (
                                <div key={secao.id} style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.4)',
                                    border: '1px solid var(--border-color)',
                                    position: 'relative'
                                }}>
                                    <button
                                        onClick={() => removeSecao(secao.id)}
                                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--error-color)', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div style={{ marginBottom: '0.8rem', paddingRight: '2rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Título do Grupo</label>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ height: '32px', fontSize: '0.9rem' }}
                                                value={secao.titulo}
                                                onChange={(e) => updateSecao(secao.id, 'titulo', e.target.value)}
                                            />
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                                <button onClick={() => handleFontSize('secaoTitulos', secao.id, 'increase')} className="btn-icon-mini"><ChevronUp size={12} /></button>
                                                <button onClick={() => handleFontSize('secaoTitulos', secao.id, 'decrease')} className="btn-icon-mini"><ChevronDown size={12} /></button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Itens da Lista (um por linha)</label>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'start' }}>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '80px', fontSize: '0.85rem', paddingTop: '0.5rem' }}
                                                value={secao.itens}
                                                onChange={(e) => updateSecao(secao.id, 'itens', e.target.value)}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button onClick={() => handleFontSize('secaoListas', secao.id, 'increase')} className="btn-icon-mini"><ChevronUp size={12} /></button>
                                                <button onClick={() => handleFontSize('secaoListas', secao.id, 'decrease')} className="btn-icon-mini"><ChevronDown size={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contact Card */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MessageSquare size={18} className="text-primary" />
                            Informações de Contato
                        </h3>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
                            <button
                                className={`btn ${contatoTipo === 'whatsapp' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    setContatoTipo('whatsapp');
                                    if (contatoTexto.includes('e-mail')) setContatoTexto('Interessados enviar currículo para o WhatsApp:');
                                }}
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                            >
                                <MessageSquare size={14} /> WhatsApp
                            </button>
                            <button
                                className={`btn ${contatoTipo === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    setContatoTipo('email');
                                    if (contatoTexto.includes('WhatsApp')) setContatoTexto('Interessados encaminhar currículo para o e-mail:');
                                }}
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                            >
                                <Mail size={14} /> E-mail
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="campo-grupo">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Texto Chamada</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={contatoTexto}
                                        onChange={(e) => setContatoTexto(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button onClick={() => handleFontSize('contato', null, 'increase')} className="btn-icon-mini"><ChevronUp size={14} /></button>
                                        <button onClick={() => handleFontSize('contato', null, 'decrease')} className="btn-icon-mini"><ChevronDown size={14} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="campo-grupo">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                                    {contatoTipo === 'whatsapp' ? 'Número do WhatsApp' : 'E-mail para Contato'}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={contatoTipo === 'whatsapp' ? contatoWhatsapp : contatoEmail}
                                    onChange={(e) => {
                                        if (contatoTipo === 'whatsapp') setContatoWhatsapp(e.target.value);
                                        else setContatoEmail(e.target.value);
                                    }}
                                    placeholder={contatoTipo === 'whatsapp' ? "(00) 00000-0000" : "exemplo@email.com"}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* 2. MIDDLE: PREVIEW */}
                <div style={{ position: 'sticky', top: '1rem' }}>
                    <div style={{
                        width: '540px',
                        height: '675px',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.4), 0 18px 36px -18px rgba(0,0,0,0.5)',
                        background: '#1a1a1a',
                        border: '8px solid #222',
                        margin: '0 auto'
                    }}>
                        <style>{`
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap');
                            
                            .vac-preview-container {
                                width: 1080px;
                                height: 1350px;
                                position: relative;
                                background-size: cover;
                                background-position: center;
                                transform-origin: top left;
                                transform: scale(0.5);
                                color: #1E2732;
                                font-family: 'Poppins', sans-serif;
                            }

                            .vac-content {
                                position: absolute;
                                top: 220px;
                                left: 0;
                                width: 100%;
                                display: flex;
                                flex-direction: column;
                                padding: 0 90px;
                                box-sizing: border-box;
                            }

                            .vac-badge {
                                background-color: #E41E2A;
                                color: white;
                                padding: 10px 40px;
                                font-weight: 900;
                                font-size: 60px;
                                letter-spacing: 1px;
                                display: inline-block;
                                margin-bottom: 20px;
                                border-radius: 50px;
                                align-self: flex-start;
                            }

                            .vac-title {
                                font-weight: 900;
                                margin: 10px 0;
                                line-height: 1.1;
                            }

                            .vac-location-box {
                                border: 4px solid #E41E2A;
                                padding: 10px 30px;
                                margin-top: 20px;
                                margin-bottom: 50px;
                                border-radius: 50px;
                                display: inline-flex;
                                align-items: center;
                                gap: 15px;
                                align-self: flex-start;
                            }

                            .vac-section {
                                margin-bottom: 30px;
                            }

                            .vac-section-title {
                                background-color: #E41E2A;
                                color: white;
                                font-weight: 700;
                                padding: 10px 30px;
                                display: inline-block;
                                border-radius: 50px;
                                margin-bottom: 15px;
                            }

                            .vac-list {
                                list-style: none;
                                padding: 0;
                                margin: 0;
                                line-height: 1.4;
                                color: #333;
                            }

                            .vac-contact-area {
                                display: flex;
                                align-items: center;
                                gap: 20px;
                                margin-top: 20px;
                            }

                            .vac-whatsapp-icon {
                                width: 70px;
                                height: 70px;
                            }

                            .vac-contact-text {
                                margin: 0;
                                line-height: 1.3;
                                font-weight: 700;
                            }

                            .btn-icon-mini {
                                width: 22px;
                                height: 22px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: white;
                                border: 1px solid var(--border-color);
                                border-radius: 4px;
                                cursor: pointer;
                                color: var(--text-secondary);
                                transition: all 0.2s;
                            }
                            .btn-icon-mini:hover {
                                background: var(--primary-light);
                                color: var(--primary-color);
                                border-color: var(--primary-color);
                            }
                        `}</style>

                        <div
                            ref={previewRef}
                            className="vac-preview-container"
                            style={{ backgroundImage: `url(${bgUrl})` }}
                        >
                            <div className="vac-content">
                                <div className="vac-badge">Estamos Contratando</div>

                                <h1 className="vac-title" style={{ fontSize: `${fontSizes.vaga}px` }}>
                                    {vaga || 'Nome da Vaga'}
                                </h1>

                                <div className="vac-location-box">
                                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M16 0C9.373 0 4 5.373 4 12C4 18.627 16 32 16 32C16 32 28 18.627 28 12C28 5.373 22.627 0 16 0ZM16 18C12.686 18 10 15.314 10 12C10 8.686 12.686 6 16 6C19.314 6 22 8.686 22 12C22 15.314 19.314 18 16 18Z" fill="#E41E2A" />
                                    </svg>
                                    <span style={{ fontSize: `${fontSizes.localidade}px`, fontWeight: 700 }}>
                                        {localidade || 'Localidade'}
                                    </span>
                                </div>

                                <div className="vac-sections-wrapper">
                                    {secoes.map((s) => (
                                        <div key={s.id} className="vac-section">
                                            {s.titulo && (
                                                <div className="vac-section-title" style={{ fontSize: `${(fontSizes.secaoTitulos && fontSizes.secaoTitulos[s.id]) || 32}px` }}>
                                                    {s.titulo}
                                                </div>
                                            )}
                                            {s.itens && (
                                                <ul className="vac-list" style={{ fontSize: `${(fontSizes.secaoListas && fontSizes.secaoListas[s.id]) || 28}px` }}>
                                                    {s.itens.split('\n').filter(i => i.trim()).map((item, idx) => (
                                                        <li key={idx} style={{ marginBottom: '8px' }}>{item}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="vac-contact-area">
                                    {contatoTipo === 'whatsapp' ? (
                                        <img src="https://i.imgur.com/4Ub0bmW.png" className="vac-whatsapp-icon" alt="WhatsApp" />
                                    ) : (
                                        <div style={{
                                            width: '70px',
                                            height: '70px',
                                            background: '#E41E2A',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 8px 20px rgba(228, 30, 42, 0.25)'
                                        }}>
                                            <Mail size={40} color="white" />
                                        </div>
                                    )}
                                    <div className="vac-contact-text" style={{ fontSize: `${fontSizes.contato}px` }}>
                                        <div>{contatoTexto}</div>
                                        <div style={{ color: '#E41E2A', fontSize: '1.2em' }}>
                                            {contatoTipo === 'whatsapp' ? contatoWhatsapp : contatoEmail}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Editor Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleSaveTemplate(false)}
                            disabled={isSaving}
                            style={{ flex: 1, padding: '1rem', height: 'auto', fontSize: '1rem', fontWeight: 700, gap: '0.8rem' }}
                        >
                            {isSaving ? <div className="loading-spinner" /> : <Save size={20} />}
                            {selectedTemplateId ? 'SALVAR ALTERAÇÕES' : 'SALVAR NO HISTÓRICO'}
                        </button>

                        {selectedTemplateId && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleSaveTemplate(true)}
                                disabled={isSaving}
                                style={{ flex: 1, padding: '1rem', height: 'auto', fontSize: '1rem', fontWeight: 700, gap: '0.8rem' }}
                            >
                                <Plus size={20} /> SALVAR COMO NOVA
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. RIGHT: TEMPLATES SIDEBAR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    <div className="glass-card" style={{ padding: '1.5rem', maxHeight: '100vh', position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column' }}>
                        <h3 className="title" style={{ fontSize: '1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={16} className="text-primary" />
                            Histórico de Vagas
                        </h3>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.5rem' }}>
                            <button
                                onClick={() => {
                                    setSelectedTemplateId(null);
                                    setVaga('Nova Vaga');
                                    setLocalidade('Cidade');
                                    setBgUrl(companyDefaultBg);
                                    setSecoes([
                                        { id: '1', titulo: 'REQUISITOS', itens: '' },
                                        { id: '2', titulo: 'DIFERENCIAL', itens: '' }
                                    ]);
                                }}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '2px dashed var(--border-color)',
                                    background: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                            >
                                <Plus size={16} /> Limpar Editor
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.5rem', padding: '0.8rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Filtrar por Vaga..."
                                        value={filterVaga}
                                        onChange={(e) => setFilterVaga(e.target.value)}
                                        style={{ fontSize: '0.75rem', height: '32px', paddingLeft: '2.2rem' }}
                                    />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={14} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Filtrar por Cidade..."
                                        value={filterCidade}
                                        onChange={(e) => setFilterCidade(e.target.value)}
                                        style={{ fontSize: '0.75rem', height: '32px', paddingLeft: '2.2rem' }}
                                    />
                                </div>
                            </div>

                            {templates.filter(temp => {
                                const matchesVaga = (temp.vaga || '').toLowerCase().includes(filterVaga.toLowerCase());
                                const matchesCidade = (temp.localidade || '').toLowerCase().includes(filterCidade.toLowerCase());
                                return matchesVaga && matchesCidade;
                            }).map(temp => (
                                <div
                                    key={temp.id}
                                    onClick={() => loadTemplate(temp)}
                                    style={{
                                        padding: '1.2rem',
                                        borderRadius: '16px',
                                        border: `1px solid ${selectedTemplateId === temp.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                        background: selectedTemplateId === temp.id ? 'var(--primary-light)' : 'white',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative',
                                        boxShadow: selectedTemplateId === temp.id ? '0 10px 25px -10px rgba(var(--primary-rgb), 0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
                                        marginBottom: '0.4rem'
                                    }}
                                >
                                    {/* Header with Title and Delete */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-color)', lineHeight: 1.2, flex: 1 }}>
                                            {temp.vaga || 'Sem Título'}
                                        </div>
                                        <button
                                            onClick={(e) => deleteTemplate(temp.id, e)}
                                            style={{
                                                padding: '0.4rem',
                                                borderRadius: '8px',
                                                background: 'rgba(239, 68, 68, 0.08)',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                marginLeft: '0.5rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Location and Count Details */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <MapPin size={12} className="text-primary" /> {temp.localidade || 'Brasil'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Briefcase size={12} className="text-primary" /> {temp.secoes?.length || 0} Grupos
                                        </div>
                                    </div>

                                    {/* Section Names Preview */}
                                    {temp.secoes && temp.secoes.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '1rem' }}>
                                            {temp.secoes.slice(0, 3).map((s: any) => (
                                                <span key={s.id} style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px', color: 'var(--text-muted)', border: '1px solid rgba(0,0,0,0.02)' }}>
                                                    {s.titulo}
                                                </span>
                                            ))}
                                            {temp.secoes.length > 3 && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>+{temp.secoes.length - 3}</span>}
                                        </div>
                                    )}

                                    {/* Font Config Summary */}
                                    <div style={{
                                        marginTop: 'auto',
                                        paddingTop: '0.8rem',
                                        borderTop: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.65rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                                Vaga: <b>{temp.fontSizes?.vaga || 'N/A'}px</b>
                                            </span>
                                            <span style={{ fontSize: '0.65rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                                Loc: <b>{temp.fontSizes?.localidade || 'N/A'}px</b>
                                            </span>
                                            <span style={{ fontSize: '0.65rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                                Cont: <b>{temp.fontSizes?.contato || 'N/A'}px</b>
                                            </span>
                                        </div>

                                        {temp.updatedAt && (
                                            <div style={{ marginTop: '4px', fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                                <Clock size={10} /> {temp.updatedAt.toDate ? new Date(temp.updatedAt.toDate()).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recentemente'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {templates.length > 0 && templates.filter(temp => {
                                const matchesVaga = (temp.vaga || '').toLowerCase().includes(filterVaga.toLowerCase());
                                const matchesCidade = (temp.localidade || '').toLowerCase().includes(filterCidade.toLowerCase());
                                return matchesVaga && matchesCidade;
                            }).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}><Filter size={24} style={{ opacity: 0.3 }} /></div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhum resultado para os filtros.</p>
                                        <button
                                            onClick={() => { setFilterVaga(''); setFilterCidade(''); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.5rem', textDecoration: 'underline' }}
                                        >
                                            Limpar filtros
                                        </button>
                                    </div>
                                )}

                            {templates.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>📭</div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nenhuma vaga salva.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default JobVacancyModule;
