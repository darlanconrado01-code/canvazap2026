
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, writeBatch, arrayUnion, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Layout,
    Type,
    Image as ImageIcon,
    Download,
    Settings,
    Grid,
    Search,
    Plus,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Copy,
    Loader2,
    Check,
    AlertTriangle,
    Maximize,
    Smartphone,
    Square,
    Layers,
    X,
    ImagePlus,
    FileText,
    DownloadCloud,
    Trophy
} from 'lucide-react';
import { ProductItem } from './FlyerTypes';
import { SmartImage } from './SmartImage';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type SlideFormat = 'stories' | 'feed' | 'square';

const LaminasModule = () => {
    const { userData } = useAuth();
    const [inputText, setInputText] = useState('');
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<SlideFormat>('stories');
    const [requestingImages, setRequestingImages] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const [activeTab, setActiveTab] = useState<'content' | 'layout'>('content');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [filterOnlyMissing, setFilterOnlyMissing] = useState(false);
    const [isEditingLayout, setIsEditingLayout] = useState(false);

    // Layout Configuration (Enriched for Advanced Mode)
    const [layoutConfig, setLayoutConfig] = useState({
        // General
        productScale: 1,
        yOffset: 0,
        contentPadding: 10,
        contentBgOpacity: 0.95,

        // Logo Empresa
        logoVisible: true,
        logoX: 50,
        logoY: 14,
        logoScale: 0.24,

        // Selo de Preço
        sealVisible: true,
        sealX: 84,
        sealY: 10,
        sealScale: 0.29,
        sealUrl: 'http://i.imgur.com/A5fwpMb.png',

        // Preço
        priceVisible: true,
        priceX: 84,
        priceY: 16,
        priceScale: 0.89,
        colorPrice: '#ffffff',

        // Descrição
        descVisible: true,
        descX: 50,
        descY: 20, // Distance from BOTTOM in %
        fontSizeDescription: 1.5,
        colorDescription: '#ffffff',

        // Códigos
        showInternalCode: true,
        codeInternalX: 17,
        codeInternalY: 5, // Distance from BOTTOM in %
        fontSizeInternalCode: 1.4,
        colorInternalCode: '#ffffff',

        showEan: false,
        codeEanX: 81,
        codeEanY: 5, // Distance from BOTTOM in %
        fontSizeEan: 1.4,
        colorEan: '#ffffff'
    });

    // Global Search
    const [globalSearch, setGlobalSearch] = useState('');
    const [globalResults, setGlobalResults] = useState<any[]>([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);

    useEffect(() => {
        if (userData?.companyId) {
            loadThemeConfig();
        }
    }, [userData, selectedFormat]);

    const loadThemeConfig = async () => {
        if (!userData?.companyId) return;
        try {
            const compDoc = await getDoc(doc(db, 'companies', userData.companyId));
            if (compDoc.exists()) {
                const data = compDoc.data();
                // We use 'default' as the key for laminas since there is no theme selection
                const overrides = data.temaLayoutOverrides?.['default']?.laminas?.[selectedFormat];
                if (overrides) {
                    setLayoutConfig(prev => ({ ...prev, ...overrides }));
                }
            }
        } catch (e) {
            console.error("Error loading layout overrides:", e);
        }
    };

    const handleGlobalSearch = async (val: string) => {
        setGlobalSearch(val);
        if (val.length < 3) {
            setGlobalResults([]);
            return;
        }

        setSearchingGlobal(true);
        try {
            const term = val.toLowerCase();
            let results: any[] = [];

            // If it looks like an EAN, try direct match first
            if (/^\d{8,14}$/.test(term)) {
                const qEan = query(collection(db, 'products'), where('ean', '==', term), limit(5));
                const snapEan = await getDocs(qEan);
                results = snapEan.docs.map(doc => doc.data());
            }

            // If no EAN results or searching by text, do a broader search
            if (results.length === 0) {
                const q = query(collection(db, 'products'), limit(100));
                const snap = await getDocs(q);
                results = snap.docs
                    .map(doc => doc.data())
                    .filter(p =>
                        p.name?.toLowerCase().includes(term) ||
                        p.ean?.includes(term)
                    )
                    .slice(0, 8);
            }

            setGlobalResults(results);
        } catch (error) {
            console.error(error);
        } finally {
            setSearchingGlobal(false);
        }
    };

    const addProductToList = (p: any) => {
        const textToAdd = `${p.ean || ''} ${p.name || ''} ${p.price ? 'R$ ' + p.price : ''}\n`;
        setInputText(prev => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + textToAdd);
        setGlobalSearch('');
        setGlobalResults([]);
    };

    const processInput = async () => {
        if (!inputText.trim()) return;
        setProcessing(true);

        const lines = inputText.split('\n').filter(l => l.trim());
        const parsedProducts: ProductItem[] = lines.map((line, index) => {
            let description = line;
            let price = '';
            let ean = '';
            let internalCode = '';

            const priceMatch = line.match(/(?:R\$\s*)?(\d+[.,]\d{2})(?!\d)/);
            if (priceMatch) {
                price = priceMatch[0];
                description = description.replace(priceMatch[0], '').trim();
            }

            const ean13Match = line.match(/(\d{8,14})/);
            if (ean13Match) {
                ean = ean13Match[0];
                description = description.replace(ean, '').trim();
            }

            const startCodeMatch = line.match(/^(\d+)/);
            if (startCodeMatch && startCodeMatch[0] !== ean) {
                internalCode = startCodeMatch[0];
                description = description.replace(new RegExp(`^${internalCode}`), '').trim();
            }

            description = description.replace(/^[-–\s]+|[-–\s]+$/g, '').trim();

            return {
                id: `slide-${Date.now()}-${index}`,
                rawText: line,
                description: description || 'Produto sem descrição',
                price: price || '',
                ean,
                internalCode,
                candidateUrls: ean ? [
                    `https://imagens.canvazap.com.br/laminas/${ean}.jpg`
                ] : [],
                loadingFirestore: true,
                isLinked: false
            };
        });

        setProducts(parsedProducts);
        setActiveSlide(0);

        // Fetch each product info in parallel for maximum speed
        await Promise.all(parsedProducts.map((p, i) => checkProductInfo(p, i)));
        setProcessing(false);
    };

    const checkProductInfo = async (p: ProductItem, index: number) => {
        let foundData: any = null;
        let finalEan = p.ean;

        // 1. Try search by EAN
        if (finalEan) {
            const q = query(collection(db, 'products'), where('ean', '==', finalEan));
            const snap = await getDocs(q);
            if (!snap.empty) foundData = snap.docs[0].data();
        }

        // 2. Fallback: search by internalCode (scoped to company)
        if (!foundData && p.internalCode && userData?.companyId) {
            const q = query(
                collection(db, 'products'),
                where('internalCode', '==', p.internalCode),
                where('companyId', '==', userData.companyId)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                foundData = snap.docs[0].data();
                if (foundData.ean) finalEan = foundData.ean;
            }
        }

        let imageUrl = '';
        let isLinked = false;

        // 3. Priority: Always check for the Laminas-specific high-res image first
        if (finalEan) {
            const primaryUrl = `https://imagens.canvazap.com.br/laminas/${finalEan}.jpg`;
            const exists = await checkImageExists(primaryUrl);
            if (exists) {
                imageUrl = primaryUrl;
                isLinked = true;
            }
        }

        // 4. Fallback: If no high-res lamina found, use the one from database if it's NOT a .png (isolated product)
        // or just use it as last resort if it exists.
        if (!isLinked && foundData?.imageUrl) {
            imageUrl = foundData.imageUrl;
            isLinked = true;
        }

        // Optimization: If we found an image that wasn't marked, update the DB
        if (isLinked && finalEan && !foundData?.hasImage) {
            setDoc(doc(db, 'products', finalEan), {
                hasImage: true,
                imageUrl: imageUrl,
                updatedAt: new Date()
            }, { merge: true }).catch(err => console.error("Error updating image flag:", err));

            // Also resolve any pending request if it exists
            updateDoc(doc(db, 'product_requests', finalEan), {
                status: 'resolved',
                resolvedAt: new Date(),
                autoResolved: true
            }).catch(() => { /* ignore if request doesn't exist */ });
        }

        setProducts(prev => {
            const next = [...prev];
            if (next[index]) {
                next[index] = {
                    ...next[index],
                    imageUrl,
                    isLinked,
                    ean: finalEan || next[index].ean,
                    loadingFirestore: false,
                    internalCode: foundData?.internalCode || next[index].internalCode
                };
            }
            return next;
        });
    };

    const checkImageExists = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = '';
                resolve(false);
            }, 3000);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            img.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
            img.src = url;
        });
    };

    const handleRequestImages = async () => {
        const canRequest = products.filter(p => !p.isLinked && !!p.ean);
        if (canRequest.length === 0) return;

        if (!confirm(`Solicitar imagens para ${canRequest.length} itens?`)) return;

        setRequestingImages(true);
        try {
            const batch = writeBatch(db);
            const compDoc = await getDoc(doc(db, 'companies', userData!.companyId));
            const companyName = compDoc.exists() ? compDoc.data().name : 'Empresa';

            canRequest.forEach(p => {
                const reqRef = doc(db, 'product_requests', p.ean);
                batch.set(reqRef, {
                    ean: p.ean,
                    description: p.description,
                    internalCode: p.internalCode || '',
                    companyId: userData!.companyId,
                    companyName,
                    userName: userData!.name,
                    status: 'pending',
                    type: 'laminas',
                    lastRequestedAt: new Date(),
                    requesters: arrayUnion({
                        companyId: userData!.companyId,
                        companyName,
                        userName: userData!.name,
                        requestedAt: new Date()
                    })
                }, { merge: true });
            });
            await batch.commit();
            alert("Solicitações enviadas!");
        } catch (e) {
            console.error(e);
        } finally {
            setRequestingImages(false);
        }
    };

    const handleExportAll = async () => {
        if (products.length === 0) return;

        setProcessing(true);
        const zip = new JSZip();
        const container = document.getElementById('laminas-export-container');
        if (!container) {
            alert("Erro ao preparar exportação.");
            setProcessing(false);
            return;
        }

        try {
            const linkedProducts = products.filter(p => p.isLinked);
            if (linkedProducts.length === 0) {
                alert("Nenhuma lâmina pronta para baixar.");
                setProcessing(false);
                return;
            }

            // Find index mapping since we iterate linked products but need full list index for state
            for (let p of linkedProducts) {
                const idx = products.findIndex(item => item.id === p.id);
                setActiveSlide(idx);
                // Wait for render and image load
                await new Promise(r => setTimeout(r, 800));

                const canvas = await html2canvas(container, {
                    useCORS: true,
                    scale: 3,
                    backgroundColor: null
                });

                const blob = await new Promise<Blob | null>(resolve =>
                    canvas.toBlob(resolve, 'image/png')
                );

                if (blob) {
                    const fileName = `${idx + 1}_${p.description.substring(0, 30).replace(/[/\\?%*:|"<>]/g, '-')}.png`;
                    zip.file(fileName, blob);
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `laminas_${Date.now()}.zip`);
        } catch (error) {
            console.error(error);
            alert("Erro ao exportar imagens.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadSingle = async (index: number) => {
        setActiveSlide(index);
        setProcessing(true);
        await new Promise(r => setTimeout(r, 800));
        const container = document.getElementById('laminas-export-container');
        if (!container) return;

        try {
            const canvas = await html2canvas(container, {
                useCORS: true,
                scale: 3,
                backgroundColor: null
            });
            canvas.toBlob((blob) => {
                if (blob) {
                    saveAs(blob, `lamina_${products[index].ean || index}.png`);
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveLayout = async () => {
        if (!userData?.companyId) return;
        setProcessing(true);
        try {
            const companyRef = doc(db, 'companies', userData.companyId);
            await setDoc(companyRef, {
                temaLayoutOverrides: {
                    default: {
                        laminas: {
                            [selectedFormat]: layoutConfig
                        }
                    }
                }
            }, { merge: true });
            alert("Layout salvo com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar layout.");
        } finally {
            setProcessing(false);
        }
    };

    const handleCopyAllAsTable = () => {
        if (products.length === 0) return;
        const header = "CÓDIGO | DESCRIÇÃO | PREÇO | EAN\n";
        const rows = products.map(p =>
            `${p.internalCode || ''} | ${p.description} | ${p.price || ''} | ${p.ean || ''}`
        ).join('\n');
        navigator.clipboard.writeText(header + rows);
        alert("Lista copiada como tabela!");
    };

    const formatPrice = (priceStr: string) => {
        if (!priceStr) return null;
        const clean = priceStr.replace('R$', '').trim();
        const parts = clean.split(/[.,]/);
        if (parts.length === 1) return { int: parts[0], cents: '00' };
        return { int: parts[0], cents: parts[1].padEnd(2, '0').substring(0, 2) };
    };

    const foundCount = products.filter(p => p.isLinked).length;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 100px)' }}>

            {/* Header Banner */}
            {foundCount > 0 && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '1rem 2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #bbf7d0', animation: 'slideInDown 0.5s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'white', borderRadius: '50%', padding: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}><Trophy size={20} color="#22c55e" /></div>
                        <div>
                            <span style={{ fontWeight: 800, fontSize: '1rem' }}>Parabéns! Encontramos {foundCount} lâminas prontas!</span>
                            {products.length > foundCount && <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{products.length - foundCount} itens ainda estão pendentes.</div>}
                        </div>
                    </div>
                    <button className="btn" style={{ background: '#22c55e', color: 'white', border: 'none', padding: '10px 20px', fontWeight: 600 }} onClick={handleExportAll} disabled={processing}>
                        <DownloadCloud size={18} /> Baixar todas as imagens
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* LEFT SIDEBAR: Input and Format */}
                <div style={{ width: '350px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '5px' }}>
                    <div className="glass-card" style={{ padding: '1.2rem' }}>
                        <div>
                            <h2 className="title" style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>Solicitação de Lâminas Plus</h2>
                            <p className="subtitle" style={{ fontSize: '0.8rem' }}>Cole os produtos abaixo para buscar as lâminas correspondentes.</p>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
                                placeholder="0201227 BUJAO CARTER R$ 25,90&#10;7891234567890 ARROZ 5KG"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <button className="btn btn-primary" style={{ width: '100%', padding: '10px', fontWeight: 700 }} onClick={processInput} disabled={processing}>
                                {processing ? <Loader2 className="loading-spinner" /> : 'Processar'}
                            </button>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Layout e Formato</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ajuste a aparência das lâminas.</p>
                            </div>
                            {(userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.isSystemAdmin) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isEditingLayout ? 'var(--primary-color)' : '#94a3b8' }}>{isEditingLayout ? 'Editando' : 'Visualizar'}</span>
                                        <div className="toggle-switch" onClick={() => setIsEditingLayout(!isEditingLayout)} style={{ background: isEditingLayout ? 'var(--primary-color)' : '#e2e8f0' }}>
                                            <div className="toggle-knob" style={{ transform: isEditingLayout ? 'translateX(18px)' : 'translateX(0)' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Formato de Exibição</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            {[
                                { id: 'feed', icon: Maximize, label: 'Feed' },
                                { id: 'square', icon: Square, label: 'Quadrado' },
                                { id: 'stories', icon: Smartphone, label: 'Stories' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    className={`btn-secondary ${selectedFormat === f.id ? 'active' : ''}`}
                                    style={{ padding: '10px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}
                                    onClick={() => setSelectedFormat(f.id as SlideFormat)}
                                >
                                    <f.icon size={16} />
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results List (Mini view) */}
                    {products.length > 0 && (
                        <div className="glass-card" style={{ padding: '1.2rem', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.8rem' }}>Itens Processados ({products.length})</h4>
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {products.map((p, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setActiveSlide(i)}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '8px',
                                            background: activeSlide === i ? '#f0f7ff' : '#f8fafc',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            border: activeSlide === i ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ width: '34px', height: '34px', background: 'white', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                                            {p.imageUrl ? <img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={16} color="#cbd5e1" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1e293b' }}>{p.description}</div>
                                            <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 600 }}>{p.price}</div>
                                        </div>
                                        {p.isLinked ? <Check size={14} color="#22c55e" /> : <AlertTriangle size={14} color="#ef4444" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* CENTER: Main Preview */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                        {products.length > 0 ? (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2rem'
                            }}>
                                <div style={{
                                    position: 'relative',
                                    height: '100%',
                                    aspectRatio: selectedFormat === 'stories' ? '9/16' : selectedFormat === 'feed' ? '4/5' : '1/1',
                                    background: 'white',
                                    boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
                                    borderRadius: '8px',
                                    overflow: 'hidden'
                                }}>
                                    {products[activeSlide]?.isLinked ? (
                                        <img src={products[activeSlide].imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                                            <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                                <ImageIcon size={80} style={{ opacity: 0.1 }} />
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Imagem não disponível</p>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
                                        {/* Logo */}
                                        {layoutConfig.logoVisible && userData?.logoUrl && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.logoX}%`,
                                                top: `${layoutConfig.logoY}%`,
                                                transform: `translate(-50%, -50%) scale(${layoutConfig.logoScale * 5})`
                                            }}>
                                                <img src={userData.logoUrl} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} />
                                            </div>
                                        )}

                                        {/* Selo Preço */}
                                        {layoutConfig.sealVisible && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.sealX}%`,
                                                top: `${layoutConfig.sealY}%`,
                                                transform: `translate(-50%, -50%) scale(${layoutConfig.sealScale * 5})`
                                            }}>
                                                <img src={layoutConfig.sealUrl} style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                                            </div>
                                        )}

                                        {/* Preço Texto */}
                                        {layoutConfig.priceVisible && products[activeSlide]?.price && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.priceX}%`,
                                                top: `${layoutConfig.priceY}%`,
                                                transform: `translate(-50%, -50%) scale(${layoutConfig.priceScale * 1.5})`,
                                                color: layoutConfig.colorPrice,
                                                fontWeight: 950,
                                                textAlign: 'center',
                                                fontSize: '1.4rem',
                                                whiteSpace: 'nowrap',
                                                lineHeight: 1
                                            }}>
                                                {(() => {
                                                    const parts = formatPrice(products[activeSlide].price);
                                                    if (!parts) return null;
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                            <span style={{ fontSize: '0.6rem', marginTop: '0.2rem' }}>R$</span>
                                                            <span>{parts.int}</span>
                                                            <span style={{ fontSize: '0.6rem', marginTop: '0.2rem' }}>,{parts.cents}</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Descrição */}
                                        {layoutConfig.descVisible && products[activeSlide] && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.descX}%`,
                                                bottom: `${layoutConfig.descY}%`,
                                                transform: 'translateX(-50%)',
                                                color: layoutConfig.colorDescription,
                                                fontSize: `${layoutConfig.fontSizeDescription / 2}rem`,
                                                fontWeight: 800,
                                                textAlign: 'center',
                                                width: '90%',
                                                lineHeight: 1.1,
                                                textShadow: '0 2px 4px rgba(0,0,0,0.6)'
                                            }}>
                                                {products[activeSlide].description}
                                            </div>
                                        )}

                                        {/* Códigos */}
                                        {layoutConfig.showInternalCode && products[activeSlide]?.internalCode && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.codeInternalX}%`,
                                                bottom: `${layoutConfig.codeInternalY}%`,
                                                color: layoutConfig.colorInternalCode,
                                                fontSize: `${layoutConfig.fontSizeInternalCode * 6}px`,
                                                fontWeight: 700,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.6)'
                                            }}>
                                                Cód: {products[activeSlide].internalCode}
                                            </div>
                                        )}

                                        {layoutConfig.showEan && products[activeSlide]?.ean && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layoutConfig.codeEanX}%`,
                                                bottom: `${layoutConfig.codeEanY}%`,
                                                color: layoutConfig.colorEan,
                                                fontSize: `${layoutConfig.fontSizeEan * 6}px`,
                                                fontWeight: 700,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.6)'
                                            }}>
                                                EAN: {products[activeSlide].ean}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="btn-icon"
                                        style={{ position: 'absolute', bottom: '15px', right: '15px', height: '40px', width: '40px', zIndex: 100, background: '#3b82f6', color: 'white', border: 'none', boxShadow: '0 10px 20px rgba(59,130,246,0.3)', pointerEvents: 'auto' }}
                                        onClick={() => handleDownloadSingle(activeSlide)}
                                    >
                                        <DownloadCloud size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                                <div style={{ background: 'white', padding: '3rem', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.02)' }}>
                                    <FileText size={80} style={{ opacity: 0.1 }} />
                                </div>
                                <h3 style={{ color: '#94a3b8', fontWeight: 700 }}>Nenhuma lâmina gerada</h3>
                                <p>Cole sua lista de produtos no campo ao lado.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDEBAR: Advanced Settings */}
                {isEditingLayout && (
                    <div className="glass-card" style={{ width: '300px', flexShrink: 0, overflowY: 'auto', padding: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={18} className="text-blue-500" />
                                <h4 style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.5px' }}>Ajustes Visuais</h4>
                            </div>
                            <button onClick={() => setIsEditingLayout(false)} className="btn-icon" style={{ height: '30px', width: '30px' }}><X size={16} /></button>
                        </div>

                        <div className="settings-accordion" style={{ flex: 1 }}>
                            <details open>
                                <summary>Logo da Empresa</summary>
                                <div className="settings-content">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span>Visível</span>
                                        <input type="checkbox" checked={layoutConfig.logoVisible} onChange={e => setLayoutConfig({ ...layoutConfig, logoVisible: e.target.checked })} />
                                    </div>
                                    <label>Ajuste Vertical (Y): {layoutConfig.logoY}%</label>
                                    <input type="range" value={layoutConfig.logoY} onChange={e => setLayoutConfig({ ...layoutConfig, logoY: Number(e.target.value) })} />
                                    <label>Ajuste Horizontal (X): {layoutConfig.logoX}%</label>
                                    <input type="range" value={layoutConfig.logoX} onChange={e => setLayoutConfig({ ...layoutConfig, logoX: Number(e.target.value) })} />
                                    <label>Tamanho: {Math.round(layoutConfig.logoScale * 100)}%</label>
                                    <input type="range" min="0.05" max="1" step="0.01" value={layoutConfig.logoScale} onChange={e => setLayoutConfig({ ...layoutConfig, logoScale: Number(e.target.value) })} />
                                </div>
                            </details>

                            <details>
                                <summary>Selo de Preço</summary>
                                <div className="settings-content">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span>Visível</span>
                                        <input type="checkbox" checked={layoutConfig.sealVisible} onChange={e => setLayoutConfig({ ...layoutConfig, sealVisible: e.target.checked })} />
                                    </div>
                                    <label>Ajuste Vertical (Y): {layoutConfig.sealY}%</label>
                                    <input type="range" value={layoutConfig.sealY} onChange={e => setLayoutConfig({ ...layoutConfig, sealY: Number(e.target.value) })} />
                                    <label>Ajuste Horizontal (X): {layoutConfig.sealX}%</label>
                                    <input type="range" value={layoutConfig.sealX} onChange={e => setLayoutConfig({ ...layoutConfig, sealX: Number(e.target.value) })} />
                                    <label>Tamanho: {Math.round(layoutConfig.sealScale * 100)}%</label>
                                    <input type="range" min="0.05" max="1" step="0.01" value={layoutConfig.sealScale} onChange={e => setLayoutConfig({ ...layoutConfig, sealScale: Number(e.target.value) })} />
                                </div>
                            </details>

                            <details>
                                <summary>Preço de Venda</summary>
                                <div className="settings-content">
                                    <label>Ajuste Vertical (Y): {layoutConfig.priceY}%</label>
                                    <input type="range" value={layoutConfig.priceY} onChange={e => setLayoutConfig({ ...layoutConfig, priceY: Number(e.target.value) })} />
                                    <label>Ajuste Horizontal (X): {layoutConfig.priceX}%</label>
                                    <input type="range" value={layoutConfig.priceX} onChange={e => setLayoutConfig({ ...layoutConfig, priceX: Number(e.target.value) })} />
                                    <label>Tamanho: {Math.round(layoutConfig.priceScale * 100)}%</label>
                                    <input type="range" min="0.1" max="3" step="0.1" value={layoutConfig.priceScale} onChange={e => setLayoutConfig({ ...layoutConfig, priceScale: Number(e.target.value) })} />
                                    <label>Cor do Preço</label>
                                    <input type="color" value={layoutConfig.colorPrice} onChange={e => setLayoutConfig({ ...layoutConfig, colorPrice: e.target.value })} style={{ width: '100%', height: '35px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px', cursor: 'pointer' }} />
                                </div>
                            </details>

                            <details>
                                <summary>Descrição do Produto</summary>
                                <div className="settings-content">
                                    <label>Distância do Fundo (Y): {layoutConfig.descY}%</label>
                                    <input type="range" value={layoutConfig.descY} onChange={e => setLayoutConfig({ ...layoutConfig, descY: Number(e.target.value) })} />
                                    <label>Posição Horizontal (X): {layoutConfig.descX}%</label>
                                    <input type="range" value={layoutConfig.descX} onChange={e => setLayoutConfig({ ...layoutConfig, descX: Number(e.target.value) })} />
                                    <label>Tamanho da Fonte: {layoutConfig.fontSizeDescription}rem</label>
                                    <input type="range" min="0.5" max="5" step="0.1" value={layoutConfig.fontSizeDescription} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeDescription: Number(e.target.value) })} />
                                    <label>Cor do Texto</label>
                                    <input type="color" value={layoutConfig.colorDescription} onChange={e => setLayoutConfig({ ...layoutConfig, colorDescription: e.target.value })} style={{ width: '100%', height: '35px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px', cursor: 'pointer' }} />
                                </div>
                            </details>

                            <details>
                                <summary>Códigos e EAN</summary>
                                <div className="settings-content">
                                    <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>Cód. Interno</span>
                                            <input type="checkbox" checked={layoutConfig.showInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, showInternalCode: e.target.checked })} />
                                        </div>
                                        <label>Altura (Y %): {layoutConfig.codeInternalY}%</label>
                                        <input type="range" min="0" max="100" value={layoutConfig.codeInternalY} onChange={e => setLayoutConfig({ ...layoutConfig, codeInternalY: Number(e.target.value) })} />
                                        <label>Lateral (X %): {layoutConfig.codeInternalX}%</label>
                                        <input type="range" value={layoutConfig.codeInternalX} onChange={e => setLayoutConfig({ ...layoutConfig, codeInternalX: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 600 }}>Código EAN</span>
                                            <input type="checkbox" checked={layoutConfig.showEan} onChange={e => setLayoutConfig({ ...layoutConfig, showEan: e.target.checked })} />
                                        </div>
                                        <label>Altura (Y %): {layoutConfig.codeEanY}%</label>
                                        <input type="range" min="0" max="100" value={layoutConfig.codeEanY} onChange={e => setLayoutConfig({ ...layoutConfig, codeEanY: Number(e.target.value) })} />
                                        <label>Lateral (X %): {layoutConfig.codeEanX}%</label>
                                        <input type="range" value={layoutConfig.codeEanX} onChange={e => setLayoutConfig({ ...layoutConfig, codeEanX: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </details>
                        </div>

                        <div style={{ padding: '1.2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px' }} onClick={handleSaveLayout} disabled={processing}>
                                {processing ? <Loader2 className="loading-spinner" /> : 'Salvar como Padrão'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden Export Container (High Res) */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div
                    id="laminas-export-container"
                    style={{
                        aspectRatio: selectedFormat === 'stories' ? '9/16' : selectedFormat === 'feed' ? '4/5' : '1/1',
                        width: '1080px',
                        background: 'white',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {products[activeSlide] && (
                        <div style={{ position: 'absolute', inset: 0 }}>
                            {products[activeSlide].isLinked ? (
                                <img
                                    src={products[activeSlide].imageUrl}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: '#fff' }} />
                            )}

                            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                                {layoutConfig.logoVisible && userData?.logoUrl && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.logoX}%`,
                                        top: `${layoutConfig.logoY}%`,
                                        transform: `translate(-50%, -50%) scale(${layoutConfig.logoScale * 10})`
                                    }}>
                                        <img src={userData.logoUrl} style={{ maxWidth: '400px', maxHeight: '400px', objectFit: 'contain' }} />
                                    </div>
                                )}

                                {layoutConfig.sealVisible && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.sealX}%`,
                                        top: `${layoutConfig.sealY}%`,
                                        transform: `translate(-50%, -50%) scale(${layoutConfig.sealScale * 10})`
                                    }}>
                                        <img src={layoutConfig.sealUrl} style={{ width: '300px', height: '300px', objectFit: 'contain' }} />
                                    </div>
                                )}

                                {layoutConfig.priceVisible && products[activeSlide]?.price && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.priceX}%`,
                                        top: `${layoutConfig.priceY}%`,
                                        transform: `translate(-50%, -50%) scale(${layoutConfig.priceScale * 4.5})`,
                                        color: layoutConfig.colorPrice,
                                        fontWeight: 950,
                                        textAlign: 'center',
                                        fontSize: '3rem',
                                        whiteSpace: 'nowrap',
                                        lineHeight: 1
                                    }}>
                                        {(() => {
                                            const parts = formatPrice(products[activeSlide].price);
                                            if (!parts) return null;
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                    <span style={{ fontSize: '1.2rem', marginTop: '0.4rem' }}>R$</span>
                                                    <span>{parts.int}</span>
                                                    <span style={{ fontSize: '1.2rem', marginTop: '0.4rem' }}>,{parts.cents}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {layoutConfig.descVisible && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.descX}%`,
                                        bottom: `${layoutConfig.descY}%`,
                                        transform: 'translateX(-50%)',
                                        color: layoutConfig.colorDescription,
                                        fontSize: `${layoutConfig.fontSizeDescription}rem`,
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        width: '90%',
                                        lineHeight: 1.1,
                                        textShadow: '0 4px 10px rgba(0,0,0,0.7)'
                                    }}>
                                        {products[activeSlide].description}
                                    </div>
                                )}

                                {layoutConfig.showInternalCode && products[activeSlide]?.internalCode && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.codeInternalX}%`,
                                        bottom: `${layoutConfig.codeInternalY}%`,
                                        color: layoutConfig.colorInternalCode,
                                        fontSize: `${layoutConfig.fontSizeInternalCode}rem`,
                                        fontWeight: 700,
                                        textShadow: '0 2px 5px rgba(0,0,0,0.7)'
                                    }}>
                                        Cód: {products[activeSlide].internalCode}
                                    </div>
                                )}

                                {layoutConfig.showEan && products[activeSlide]?.ean && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${layoutConfig.codeEanX}%`,
                                        bottom: `${layoutConfig.codeEanY}%`,
                                        color: layoutConfig.colorEan,
                                        fontSize: `${layoutConfig.fontSizeEan}rem`,
                                        fontWeight: 700,
                                        textShadow: '0 2px 5px rgba(0,0,0,0.7)'
                                    }}>
                                        EAN: {products[activeSlide].ean}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .settings-accordion details { border-bottom: 1px solid #f1f5f9; }
                .settings-accordion summary { padding: 14px 16px; cursor: pointer; font-weight: 700; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; list-style: none; letter-spacing: 0.5px; color: #475569; }
                .settings-accordion summary::-webkit-details-marker { display: none; }
                .settings-accordion summary::after { content: '+'; font-size: 1.2rem; transition: transform 0.2s; color: #94a3b8; }
                .settings-accordion details[open] summary::after { content: '-'; transform: rotate(180deg); }
                .settings-content { padding: 0 16px 20px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 0.75rem; color: #64748b; }
                .settings-content label { font-weight: 600; margin-bottom: -2px; }
                .settings-content input[type="range"] { width: 100%; height: 6px; border-radius: 5px; background: #e2e8f0; appearance: none; }
                .settings-content input[type="range"]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; cursor: pointer; border: 2px solid white; boxShadow: 0 2px 4px rgba(0,0,0,0.1); }
                
                .toggle-switch { width: 40px; height: 22px; border-radius: 11px; position: relative; cursor: pointer; transition: all 0.3s ease; padding: 2px; }
                .toggle-knob { width: 18px; height: 18px; background: white; border-radius: 50%; transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); boxShadow: 0 2px 4px rgba(0,0,0,0.2); }
                
                @keyframes slideInDown {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                /* Mobile/Small Screen adjustments if needed */
                @media (max-width: 1024px) {
                    /* You might want to stack things or hide settings */
                }
            `}</style>
        </div>
    );
};

export default LaminasModule;
