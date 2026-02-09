import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    Wand2,
    Image as ImageIcon,
    Type,
    CheckCircle2,
    XCircle,
    Building2,
    Layout,
    Loader2,
    Download,
    Save,
    RefreshCw,
    Maximize2
} from 'lucide-react';
import { useAuth } from './AuthContext';

const SuperAdminArtModule = () => {
    const { userData } = useAuth();
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<any>(null);

    // Core Rules
    const [visualRules, setVisualRules] = useState({ allowed: '', forbidden: '' });
    const [textRules, setTextRules] = useState({ allowed: '', forbidden: '' });
    const [briefing, setBriefing] = useState('');
    const [titleText, setTitleText] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]); // IDs of selected products
    const [format, setFormat] = useState('1024x1024'); // Default generic square
    const [includeLogo, setIncludeLogo] = useState(false); // New state for logo toggle
    const [productScale, setProductScale] = useState(1); // Scale control for overlaid product

    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generatedCaption, setGeneratedCaption] = useState('');
    const [captionLoading, setCaptionLoading] = useState(false);

    useEffect(() => {
        const fetchCompanies = async () => {
            const snap = await getDocs(collection(db, 'companies'));
            setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchCompanies();
    }, []);

    useEffect(() => {
        if (!selectedCompanyId) {
            setSelectedCompany(null);
            setVisualRules({ allowed: '', forbidden: '' });
            setTextRules({ allowed: '', forbidden: '' });
            return;
        }
        const comp = companies.find(c => c.id === selectedCompanyId);
        setSelectedCompany(comp || null);

        if (comp) {
            setVisualRules({
                allowed: comp.artRules?.visualAllowed || comp.artRules?.visualGuidelines || '',
                forbidden: comp.artRules?.visualForbidden || ''
            });
            setTextRules({
                allowed: comp.artRules?.textAllowed || comp.artRules?.toneOfVoice || '',
                forbidden: comp.artRules?.textForbidden || ''
            });
        }
    }, [selectedCompanyId, companies]);

    const handleGenerateCaption = async () => {
        if (!selectedCompany || !briefing) return;
        setCaptionLoading(true);
        try {
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            const prompt = `
            Atue como um Social Media Manager expert.
            
            Cliente: ${selectedCompany.name}
            Tom de Voz / Contexto: ${textRules.allowed || selectedCompany.artRules?.toneOfVoice || 'Profissional e engajador'}
            
            Crie uma legenda criativa, engajadora e formatada para Instagram baseada neste briefing de imagem:
            "${briefing}"
            
            Inclua emojis apropriados e 3-5 hashtags relevantes.
            `;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", // Fast and capable
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0]) {
                setGeneratedCaption(data.choices[0].message.content);
            }
        } catch (error) {
            console.error("Caption error:", error);
            alert("Erro ao gerar legenda");
        } finally {
            setCaptionLoading(false);
        }
    };

    const [analysis, setAnalysis] = useState<string>(''); // Store the vision analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // ... (keep existing effects)

    const analyzeImageWithVision = async (imageUrl: string, context: string) => {
        try {
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o", // multimodal
                    messages: [
                        {
                            role: "system",
                            content: `Você é um Diretor de Arte Sênior. Sua tarefa é analisar tecnicamente uma imagem de produto/referência para guiar a criação de um cenário publicitário perfeito.
                            
                            Analise a imagem fornecida e retorne UM PARÁGRAFO DENSO E TÉCNICO descrevendo:
                            1. Iluminação (Direção, Suavidade, Sombras, temperatura de cor).
                            2. Perspectiva/Angulo (Frontal, Isometrico, Cima p/ Baixo, etc).
                            3. Paleta de Cores Dominante e Harmonias sugeridas.
                            4. Estilo Visual/Vibe (Minimalista, Rustico, Luxuoso, etc).
                            
                            O objetivo é usar essa descrição para criar um BACKGROUND que se funda perfeitamente com este objeto.`
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: `Contexto do briefing: ${context}. Analise este produto/referência:` },
                                { type: "image_url", image_url: { url: imageUrl } }
                            ]
                        }
                    ],
                    max_tokens: 300
                })
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (e) {
            console.error("Vision Error", e);
            return '';
        }
    };

    const handleGenerate = async () => {
        if (!selectedCompany) return alert('Selecione uma empresa');
        if (!briefing) return alert('Preencha o briefing');

        setLoading(true);
        setGeneratedImage(null);
        setAnalysis('');

        try {
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            let visualMapping = '';

            // STEP 1: VISION MAPPING (The "Reading" Phase)
            if (selectedProducts.length > 0) {
                setIsAnalyzing(true);
                const mainProd = selectedCompany.products.find((p: any) => p.id === selectedProducts[0]);
                if (mainProd && mainProd.imageUrl) {
                    // console.log("Mapping product visual identity...");
                    visualMapping = await analyzeImageWithVision(mainProd.imageUrl, briefing);
                    setAnalysis(visualMapping);
                }
                setIsAnalyzing(false);
            }

            // STEP 2: GENERATION (The "Creation" Phase)

            // Construct Prompt with the Mapping
            const systemPrompt = `Você é um fotógrafo de produtos premiado (Cannes Lions).
            
            SUA MISSÃO: Criar um CENÁRIO DE FUNDO (BACKGROUND) para compor com um produto real.
            
            ANÁLISE TÉCNICA DO PRODUTO (USE ISTO PARA CALIBRAR A CENA):
            ${visualMapping || 'Iluminação de estúdio neutra, cores harmoniosas.'}
            
            DIRETRIZES DE COMPOSIÇÃO:
            - A iluminação do cenário DEVE coincidir com a iluminação descrita acima (para o produto não parecer "colado").
            - A perspectiva DEVE respeitar o ângulo do produto descrito.
            - Deixe o centro (ou local de foco) livre e plano para receber o produto.
            
            Estilo Visual da Marca: ${visualRules.allowed || 'Premium, Publicitário'}.
            Evitar: ${visualRules.forbidden || 'Distorções, Poluição visual'}.
            `;

            const userPrompt = `Crie o Cenário Publicitário com o tema: "${briefing}".
            ${titleText ? `Se possível, integre o texto "${titleText}" no fundo de forma natural (neon, placa, escrita na parede), mas mantendo legibilidade.` : ''}
            `;

            const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: fullPrompt.substring(0, 4000),
                    n: 1,
                    size: format === '1080x1920' ? "1024x1792" : "1024x1024",
                    quality: "hd",
                    style: "natural"
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("OpenAI Error:", data.error);
                alert(`Erro na geração: ${data.error.message}`); // Keep alert for fatal errors
            } else {
                setGeneratedImage(data.data[0].url);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao conectar com a IA');
        } finally {
            setLoading(false);
            setIsAnalyzing(false);
        }
    };

    const handleSaveToHistory = async () => {
        if (!generatedImage || !selectedCompany) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'generated_assets'), {
                companyId: selectedCompany.id,
                companyName: selectedCompany.name,
                type: 'admin_art_layered',
                imageUrl: generatedImage,
                productIds: selectedProducts,
                productScale,
                prompt: briefing,
                visualMapping: analysis, // Save the mapping too!
                rules: { visualRules, textRules },
                format,
                caption: generatedCaption,
                createdBy: userData?.uid,
                createdAt: serverTimestamp(),
                includeLogo: includeLogo
            });
            alert('Arte salva!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="title" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Wand2 className="text-primary" /> Módulo de Criação de Artes (IA)
                </h1>
                <p className="subtitle">Geração de Cenários + Composição de Produtos (Fidelidade 100%)</p>
            </div>

            <div className="responsive-grid" style={{ gridTemplateColumns: '350px 1fr' }}>
                {/* Left Column: Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* 1. Company Selection */}
                    <div className="glass-card">
                        <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={18} /> Seleção da Empresa
                        </h3>
                        <select
                            className="form-input"
                            value={selectedCompanyId}
                            onChange={e => setSelectedCompanyId(e.target.value)}
                        >
                            <option value="">Selecione um cliente...</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {selectedCompany && (
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-color)', padding: '10px', borderRadius: '8px' }}>
                                {selectedCompany.logoUrl ? (
                                    <img src={selectedCompany.logoUrl} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px' }} />
                                )}
                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedCompany.name}</div>
                            </div>
                        )}
                    </div>

                    {/* 4. Generation Assets */}
                    {selectedCompany && (
                        <div className="glass-card">
                            <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ImageIcon size={18} /> Produto "Ator" (Obrigatório)
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                O produto selecionado será sobreposto intacto ao fundo gerado.
                            </p>

                            {/* Product Selection */}
                            {selectedCompany.products && selectedCompany.products.length > 0 ? (
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.8rem' }}>
                                        {selectedCompany.products.map((prod: any) => (
                                            <div
                                                key={prod.id}
                                                onClick={() => {
                                                    if (selectedProducts.includes(prod.id)) {
                                                        setSelectedProducts(selectedProducts.filter(id => id !== prod.id));
                                                    } else {
                                                        setSelectedProducts([...selectedProducts, prod.id]);
                                                    }
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: selectedProducts.includes(prod.id) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    opacity: selectedProducts.includes(prod.id) ? 1 : 0.7,
                                                    transform: selectedProducts.includes(prod.id) ? 'scale(1.05)' : 'scale(1)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ aspectRatio: '1/1', background: '#f8fafc', padding: '4px' }}>
                                                    <img src={prod.imageUrl} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Scale Control */}
                            {selectedProducts.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Tamanho do Produto na Arte</label>
                                    <input
                                        type="range"
                                        min="0.2"
                                        max="1.5"
                                        step="0.1"
                                        value={productScale}
                                        onChange={(e) => setProductScale(parseFloat(e.target.value))}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}

                            {/* Visual Reference Upload */}
                            <div className="form-group">
                                <label className="form-label">Referência Visual (Opcional)</label>
                                <input type="file" className="form-input" accept="image/*" id="gen-ref-upload" />
                            </div>
                        </div>
                    )}

                    {/* 5. Briefing & Format */}
                    {selectedCompany && (
                        <div className="glass-card" style={{ border: '1px solid var(--primary-color)' }}>
                            <h3 className="title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Layout size={18} /> Briefing do Cenário
                            </h3>

                            <div className="form-group">
                                <label className="form-label">Formato</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[
                                        { id: '1024x1024', label: 'Feed', icon: <Layout size={16} /> },
                                        { id: '1080x1350', label: 'Port', icon: <Layout size={16} transform="scale(0.8, 1.2)" /> },
                                        { id: '1080x1920', label: 'Story', icon: <Layout size={16} transform="scale(0.6, 1.4)" /> }
                                    ].map(fmt => (
                                        <button
                                            key={fmt.id}
                                            onClick={() => setFormat(fmt.id)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                border: format === fmt.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                background: format === fmt.id ? 'rgba(67, 24, 255, 0.05)' : 'white',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                color: format === fmt.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {fmt.icon} {fmt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Logo Toggle */}
                            <div className="form-group" style={{
                                background: '#f1f5f9',
                                padding: '12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: includeLogo ? '1px solid var(--primary-color)' : '1px solid transparent'
                            }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={includeLogo}
                                        onChange={(e) => setIncludeLogo(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                                    />
                                    <span>Inserir Logo da Empresa</span>
                                </label>
                                {includeLogo && selectedCompany?.logoUrl && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle2 size={12} />
                                        Logo Ativo
                                    </div>
                                )}
                                {includeLogo && !selectedCompany?.logoUrl && (
                                    <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <XCircle size={12} />
                                        Sem logo
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Título no Fundo (Opcional)</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: OFERTA"
                                    value={titleText}
                                    onChange={e => setTitleText(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descrição do Cenário</label>
                                <textarea
                                    className="form-input"
                                    style={{ minHeight: '100px', fontSize: '1rem' }}
                                    placeholder="Ex: Uma bancada de mármore em uma cozinha moderna e iluminada..."
                                    value={briefing}
                                    onChange={e => setBriefing(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading || isAnalyzing}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                            >
                                {isAnalyzing ? (
                                    <><Loader2 className="animate-spin" /> Lendo Imagem (Vision)...</>
                                ) : loading ? (
                                    <><Loader2 className="animate-spin" /> Criando Arte...</>
                                ) : (
                                    <><Wand2 /> Gerar Arte com IA</>
                                )}
                            </button>

                            {analysis && (
                                <div className="fade-in" style={{ marginTop: '1rem', padding: '10px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.75rem', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                    <strong>Mapeamento Visual (IA):</strong> {analysis.substring(0, 150)}...
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Right Column: Preview */}
                <div style={{ position: 'sticky', top: '20px' }}>
                    <div className="glass-card" style={{ height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                        {generatedImage ? (
                            <div className="fade-in" style={{ width: '100%', textAlign: 'center' }}>
                                <div style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                    fontSize: 0 // Remove whitespace gap
                                }}>
                                    <img src={generatedImage} alt="Gerada por IA" style={{ maxWidth: '100%', maxHeight: '600px', display: 'block' }} />

                                    {/* PRODUCT OVERLAY COMPOSITING */}
                                    {selectedProducts.map((prodId, idx) => {
                                        const prod = selectedCompany.products.find((p: any) => p.id === prodId);
                                        if (!prod) return null;
                                        const steps = selectedProducts.length;
                                        const offset = (idx - (steps - 1) / 2) * 50; // simple spread

                                        return (
                                            <img
                                                key={prodId}
                                                src={prod.imageUrl}
                                                alt="Product Actor"
                                                style={{
                                                    position: 'absolute',
                                                    left: `calc(50% + ${offset}px)`,
                                                    top: '50%',
                                                    transform: `translate(-50%, -50%) scale(${productScale})`,
                                                    maxWidth: '60%',
                                                    maxHeight: '60%',
                                                    objectFit: 'contain',
                                                    zIndex: 20,
                                                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' // Add shadow for realism
                                                }}
                                            />
                                        )
                                    })}

                                    {/* Logo Overlay */}
                                    {includeLogo && selectedCompany?.logoUrl && (
                                        <img
                                            src={selectedCompany.logoUrl}
                                            alt="Logo Overlay"
                                            style={{
                                                position: 'absolute',
                                                top: '4%',
                                                right: '4%',
                                                width: '18%',
                                                maxWidth: '120px',
                                                maxHeight: '120px',
                                                objectFit: 'contain',
                                                zIndex: 30,
                                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
                                                pointerEvents: 'none',
                                                background: 'rgba(255,255,255,0.1)',
                                                backdropFilter: 'blur(2px)',
                                                borderRadius: '8px',
                                                padding: '5px'
                                            }}
                                        />
                                    )}
                                </div>

                                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button onClick={() => window.open(generatedImage, '_blank')} className="btn btn-secondary" style={{ width: 'auto' }}>
                                        <Maximize2 size={18} /> Ver Full Background
                                    </button>
                                    <button onClick={handleSaveToHistory} disabled={saving} className="btn btn-primary" style={{ width: 'auto' }}>
                                        {saving ? 'Salvando...' : <><Save size={18} /> Salvar Arte</>}
                                    </button>
                                </div>
                                <button onClick={handleGenerate} className="btn btn-secondary" style={{ width: 'auto', fontSize: '0.9rem' }}>
                                    <RefreshCw size={16} /> Regenerar Cenário
                                </button>

                                <div style={{ marginTop: '2rem', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Type size={16} /> Sugestão de Legenda
                                    </h3>
                                    {!generatedCaption ? (
                                        <button
                                            onClick={handleGenerateCaption}
                                            disabled={captionLoading}
                                            className="btn btn-secondary"
                                            style={{ width: '100%' }}
                                        >
                                            {captionLoading ? <Loader2 className="animate-spin" /> : '✨ Gerar Legenda com IA'}
                                        </button>
                                    ) : (
                                        <div className="fade-in">
                                            <textarea
                                                className="form-input"
                                                rows={6}
                                                value={generatedCaption}
                                                onChange={(e) => setGeneratedCaption(e.target.value)}
                                                style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                                    onClick={() => { navigator.clipboard.writeText(generatedCaption); alert('Copiado!'); }}
                                                >
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {loading ? (
                                    <div className="loading-spinner" style={{ width: '60px', height: '60px', margin: '0 auto 1rem auto' }} />
                                ) : (
                                    <>
                                        <ImageIcon size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                        <h3>Aguardando Geração</h3>
                                        <p>Selecione um produto "Ator" e defina o Cenário.</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminArtModule;
