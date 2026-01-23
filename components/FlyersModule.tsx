import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, setDoc, writeBatch, arrayUnion, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Layout,
    Type,
    Image as ImageIcon,
    Download,
    Settings,
    Grid,
    Layers,
    Search,
    Plus,
    AlertCircle,
    ChevronLeft,
    ChevronsLeft,
    ChevronRight,
    ChevronsRight,
    ZoomIn,
    ZoomOut,
    Lock,
    Unlock,
    Save,
    AlertTriangle,
    Copy,
    ChevronDown,
    ImagePlus,
    Loader2,
    Check
} from 'lucide-react';
import { Theme, ProductItem, LayoutConfig } from './FlyerTypes';
import { FlyerPage } from './FlyerPage';
import { SmartImage } from './SmartImage';
import { FlyerExportOrchestrator, FlyerExportOrchestratorRef } from './FlyerExportOrchestrator';

// Export libraries
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';



const FlyersModule = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'products' | 'theme' | 'layout'>('products');

    // Inputs
    const [inputText, setInputText] = useState('');
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [globalResults, setGlobalResults] = useState<any[]>([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);

    // Theme
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
    const [loadingThemes, setLoadingThemes] = useState(false);
    const [themeSearch, setThemeSearch] = useState('');

    // Layout Config
    const [layoutConfig, setLayoutConfig] = useState({
        // Grid & Margins
        columns: 3,
        rows: 3,
        gap: 16,
        marginTop: 180,
        marginBottom: 100,
        marginLeft: 20,
        marginRight: 20,

        // Colors
        colorDescription: '#000000',
        colorPrice: '#cc0000',
        colorCode: '#666666',
        colorInternalCode: '#666666',
        colorEan: '#666666',
        colorPackaging: '#000000',

        // Typography & Visibility
        showPriceSeal: true,
        showInternalCode: true,
        showEan: false,
        fontInternalCode: 0.8, // rem
        fontEan: 0.8, // rem
        fontSizeDescription: 1, // rem
        fontSizePrice: 1.5, // rem

        // Product Card Styling
        cardBackgroundMode: 'none', // 'none' | 'white' | 'glass'
        cardOpacity: 0.8,
        cardRadius: 8,
        cardPadding: 10,

        // Spacing (internal to card)
        spacingBelowPhoto: 5,
        spacingBelowDescription: 5,
        spacingAbovePrice: 5,
        priceCentsSpacing: 2, // px adjustment for cents

        // Photo
        photoScale: 1, // 1 = 100%

        // Global Layers (Positioning on the page)
        logoConfig: { x: 23.5, y: 82, scale: 1.6, visible: true }, // x, y in %, px or mm? Mockup says px/%. Let's use internal units or assume px for Y and % for X? Mockup: Pos Y (px) 82, Pos X (%) 23.5.
        // Let's stick to the mockup units to be safe.
        // Actually, for simplicity in rendering, sticking to specific units is key. Users like pixels for absolute and % for relative.

        sideTextConfig: {
            text: 'Imagens meramente ilustrativas',
            fontSize: 14,
            color: '#333333',
            x: 2, // % 
            y: 200, // px
            scale: 1,
            rotation: -90,
            visible: true
        },
        elementsOrder: ['code', 'description', 'price']
    });

    const productsProcessedRef = useRef(false);
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
    const [currentPreviewPage, setCurrentPreviewPage] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(0.5);

    useEffect(() => {
        const savedZoom = localStorage.getItem('flyer_zoom_level');
        if (savedZoom) {
            setZoomLevel(parseFloat(savedZoom));
        }
    }, []);

    const handleZoomChange = (newZoom: number) => {
        const clamped = Math.min(Math.max(newZoom, 0.2), 1.5);
        setZoomLevel(clamped);
        localStorage.setItem('flyer_zoom_level', clamped.toString());
    };

    const checkImageExists = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    useEffect(() => {
        if (userData?.companyId) {
            fetchThemes();
            fetchCompanyLogo();
        }
    }, [userData]);

    const fetchCompanyLogo = async () => {
        if (!userData?.companyId) return;
        try {
            const docRef = doc(db, 'companies', userData.companyId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCompanyLogoUrl(docSnap.data().logoUrl || null);
            }
        } catch (e) {
            console.error("Error fetching company logo", e);
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
            // Search in global products
            const q = query(collection(db, 'products'), limit(10));
            const snap = await getDocs(q);

            // Client side filter for name or ean
            const term = val.toLowerCase();
            const results = snap.docs
                .map(doc => doc.data())
                .filter(p =>
                    p.name?.toLowerCase().includes(term) ||
                    p.ean?.includes(term)
                );

            setGlobalResults(results);
        } catch (error) {
            console.error(error);
        } finally {
            setSearchingGlobal(false);
        }
    };

    const addProductToList = (p: any) => {
        const textToAdd = `${p.ean || ''} ${p.name || ''} R$ 0,00\n`;
        setInputText(prev => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + textToAdd);
        setGlobalSearch('');
        setGlobalResults([]);
    };

    const fetchThemes = async () => {
        setLoadingThemes(true);
        try {
            const themesRef = collection(db, 'themes');
            const q = query(themesRef, where('availability', 'array-contains', 'encartes'));
            const snapshot = await getDocs(q);

            const fetchedThemes: Theme[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const isActive = data.isActive !== false;
                const isPublic = data.isPublic === true;
                const isOwner = data.companyId === userData?.companyId;
                const isAllowed = data.allowedCompanies?.includes(userData?.companyId);

                if ((isActive || isOwner) && (isPublic || isOwner || isAllowed)) {
                    fetchedThemes.push({ id: doc.id, ...data } as Theme);
                }
            });

            setThemes(fetchedThemes);
            if (fetchedThemes.length > 0) {
                setSelectedTheme(prev => {
                    if (prev) {
                        const existing = fetchedThemes.find(t => t.id === prev.id);
                        if (existing) return existing;
                    }
                    return fetchedThemes[0];
                });
            }
        } catch (error) {
            console.error("Error fetching themes:", error);
        } finally {
            setLoadingThemes(false);
        }
    };

    useEffect(() => {
        if (selectedTheme && userData?.companyId) {
            loadCustomThemeSettings();
        }
    }, [selectedTheme?.id, userData?.companyId]);

    const loadCustomThemeSettings = async () => {
        if (!selectedTheme || !userData?.companyId) return;

        try {
            const settingsId = `${userData.companyId}_${selectedTheme.id}`;
            const settingsRef = doc(db, 'company_theme_settings', settingsId);
            const settingsDoc = await getDoc(settingsRef);

            if (settingsDoc.exists()) {
                const customConfig = settingsDoc.data().layoutConfig;
                setLayoutConfig(prev => ({ ...prev, ...customConfig }));
            } else if (selectedTheme.defaultLayoutConfig) {
                setLayoutConfig(prev => ({ ...prev, ...selectedTheme.defaultLayoutConfig }));
            }
        } catch (err) {
            console.error("Erro ao carregar ajustes da empresa:", err);
            if (selectedTheme.defaultLayoutConfig) {
                setLayoutConfig(prev => ({ ...prev, ...selectedTheme.defaultLayoutConfig }));
            }
        }
    };

    const [filterOnlyMissing, setFilterOnlyMissing] = useState(true);

    const unavailableProducts = products.filter(p => !p.loadingFirestore && !p.isLinked);

    const handleCopyUnavailable = () => {
        if (unavailableProducts.length === 0) return;
        copyToTable(unavailableProducts, `${unavailableProducts.length} itens não encontrados copiados!`);
    };

    const handleCopyAllAsTable = () => {
        if (products.length === 0) return;
        copyToTable(products, `Todos os ${products.length} itens copiados como tabela!`);
    };

    const copyToTable = (itemList: any[], successMsg: string) => {
        const header = "CÓDIGO INTERNO | DESCRIÇÃO | EAN\n";
        const rows = itemList.map(p =>
            `${p.internalCode || ''} | ${p.description || ''} | ${p.ean || ''}`
        ).join('\n');

        navigator.clipboard.writeText(header + rows);
        alert(successMsg);
    };

    const [requestingImages, setRequestingImages] = useState(false);

    const handleRequestImages = async () => {
        // CRITICAL: Only items that finished Firestore check AND are still NOT linked
        const canRequest = products.filter(p => !p.loadingFirestore && !p.isLinked && !!p.ean);
        if (canRequest.length === 0) {
            alert("Nenhum item pendente com código de barras disponível para solicitação.");
            return;
        }

        if (!confirm(`Solicitar processamento de imagem para ${canRequest.length} itens faltantes?`)) return;

        setRequestingImages(true);
        try {
            const batch = writeBatch(db);

            // 1. Double check identity
            let companyName = 'Empresa Desconhecida';
            if (userData?.companyId) {
                try {
                    const compDoc = await getDoc(doc(db, 'companies', userData.companyId));
                    if (compDoc.exists()) {
                        companyName = compDoc.data().name || 'Empresa sem Nome';
                    } else {
                        console.warn("Company doc not found for ID:", userData.companyId);
                    }
                } catch (e) {
                    console.error("Error fetching company name", e);
                }
            }

            console.log(`🚀 Enviando ${canRequest.length} solicitações para: ${companyName} (${userData?.name})`);

            canRequest.forEach(p => {
                const reqRef = doc(db, 'product_requests', p.ean);
                batch.set(reqRef, {
                    ean: p.ean,
                    description: p.description,
                    internalCode: p.internalCode || '',
                    companyId: userData?.companyId || 'no-id',
                    companyName: companyName,
                    userName: userData?.name || 'Usuário Desconhecido',
                    userId: userData?.uid || 'no-uid',
                    status: 'pending',
                    type: 'images',
                    lastRequestedAt: new Date(),
                    // Track all companies that requested this
                    requesters: arrayUnion({
                        companyId: userData?.companyId || 'no-id',
                        companyName: companyName,
                        userName: userData?.name || 'Usuário Desconhecido',
                        requestedAt: new Date()
                    })
                }, { merge: true });
            });

            await batch.commit();
            alert("Solicitações enviadas com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar solicitações.");
        } finally {
            setRequestingImages(false);
        }
    };

    const handleSaveThemeConfig = async () => {
        if (!selectedTheme || !userData?.companyId) return;

        try {
            const isMasterSavingGlobal = userData.isSystemAdmin && selectedTheme.isPublic;

            if (isMasterSavingGlobal) {
                const themeRef = doc(db, 'themes', selectedTheme.id);
                await setDoc(themeRef, { defaultLayoutConfig: layoutConfig }, { merge: true });
                setSelectedTheme({ ...selectedTheme, defaultLayoutConfig: layoutConfig });
                alert('Padrão Global do tema atualizado com sucesso!');
            } else {
                const settingsId = `${userData.companyId}_${selectedTheme.id}`;
                const settingsRef = doc(db, 'company_theme_settings', settingsId);
                await setDoc(settingsRef, {
                    companyId: userData.companyId,
                    themeId: selectedTheme.id,
                    layoutConfig: layoutConfig,
                    updatedAt: new Date()
                }, { merge: true });
                alert('Seus ajustes personalizados foram salvos para este tema!');
            }
        } catch (error) {
            console.error("Erro ao salvar configurações do tema:", error);
            alert('Erro ao salvar ajustes.');
        }
    };

    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const orchestratorRef = useRef<FlyerExportOrchestratorRef>(null);

    const handleExport = (type: 'jpg-current' | 'jpg-all' | 'pdf-current' | 'pdf-all') => {
        if (!orchestratorRef.current) {
            alert('Aguarde o carregamento do módulo de exportação.');
            return;
        }

        setShowDownloadMenu(false);

        switch (type) {
            case 'jpg-current':
                orchestratorRef.current.exportCurrentPageJpg(currentPreviewPage);
                break;
            case 'jpg-all':
                orchestratorRef.current.exportAllPagesJpgZip();
                break;
            case 'pdf-current':
                orchestratorRef.current.exportCurrentPagePdf(currentPreviewPage);
                break;
            case 'pdf-all':
                orchestratorRef.current.exportAllPagesPdf();
                break;
        }
    };

    const processInput = async () => {
        if (!inputText.trim()) return;

        const lines = inputText.split('\n').filter(l => l.trim());
        const newProducts: ProductItem[] = lines.map((line, index) => {
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
            const startCodeMatch = line.match(/^(\d+)/);

            if (ean13Match) {
                ean = ean13Match[0];
                description = description.replace(ean, '').trim();
            }

            if (startCodeMatch) {
                const possibleCode = startCodeMatch[0];
                if (possibleCode !== ean) {
                    internalCode = possibleCode;
                    description = description.replace(new RegExp(`^${internalCode}`), '').trim();
                }
            }

            description = description.replace(/^[-–\s]+|[-–\s]+$/g, '').trim();

            const candidates: string[] = [];
            if (ean) {
                candidates.push(`https://imagens.canvazap.com.br/codbarras/${ean}.png`);
                candidates.push(`https://cdn-cosmos.bluesoft.com.br/products/${ean}`);
            }

            return {
                id: `p-${Date.now()}-${index}`,
                rawText: line,
                description: description || 'Sem descrição',
                price: price || '',
                ean,
                internalCode,
                candidateUrls: candidates,
                loadingFirestore: true,
                loadingImage: true,
                isLinked: false
            };
        });

        setProducts(newProducts);
        setActiveTab('theme');
        setCurrentPreviewPage(0);

        for (let i = 0; i < newProducts.length; i++) {
            checkFirestoreForProduct(newProducts[i], i);
        }
    };

    const checkFirestoreForProduct = async (product: ProductItem, index: number) => {
        try {
            let foundData: any = null;
            let resolvedEan = product.ean;

            if (!resolvedEan && product.internalCode && userData?.companyId) {
                try {
                    const qMap = query(collection(db, 'product_mappings'),
                        where('companyId', '==', userData.companyId),
                        where('internalCode', '==', product.internalCode)
                    );
                    const snapMap = await getDocs(qMap);
                    if (!snapMap.empty) {
                        const mapData = snapMap.docs[0].data();
                        if (mapData.ean) resolvedEan = mapData.ean;
                    }
                } catch (err) {
                    console.error("Error checking mappings", err);
                }
            }

            const baseConstraints = [];
            if (userData?.companyId) baseConstraints.push(where('companyId', '==', userData.companyId));

            if (resolvedEan) {
                const qEan = query(collection(db, 'products'), where('ean', '==', resolvedEan));
                const snapEan = await getDocs(qEan);
                if (!snapEan.empty) foundData = snapEan.docs[0].data();
            } else if (product.internalCode) {
                const qCode = query(collection(db, 'products'), where('internalCode', '==', product.internalCode), ...baseConstraints);
                const snapCode = await getDocs(qCode);
                if (!snapCode.empty) foundData = snapCode.docs[0].data();
            }

            let finalImageUrl = '';
            let hasFoundImage = false;
            const finalEan = product.ean || resolvedEan || foundData?.ean;
            const updatedCandidates = [...product.candidateUrls];

            if (finalEan) {
                const ext1 = `https://imagens.canvazap.com.br/codbarras/${finalEan}.png`;
                const ext2 = `https://cdn-cosmos.bluesoft.com.br/products/${finalEan}`;
                if (!updatedCandidates.includes(ext1)) updatedCandidates.unshift(ext1);
                if (!updatedCandidates.includes(ext2)) updatedCandidates.push(ext2);

                // Priority: Always try to find the isolated .png for Encartes first
                const exists = await checkImageExists(ext1);
                if (exists) {
                    finalImageUrl = ext1;
                    hasFoundImage = true;
                } else {
                    const exists2 = await checkImageExists(ext2);
                    if (exists2) {
                        finalImageUrl = ext2;
                        hasFoundImage = true;
                    }
                }
            }

            // Fallback: If no isolated image found, use what's in the database
            if (!hasFoundImage && foundData?.imageUrl) {
                finalImageUrl = foundData.imageUrl;
                hasFoundImage = true;
            }

            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = {
                        ...next[index],
                        ean: finalEan,
                        candidateUrls: updatedCandidates,
                        imageUrl: finalImageUrl,
                        loadingFirestore: false,
                        loadingImage: false,
                        isLinked: hasFoundImage
                    };
                }
                return next;
            });
        } catch (e) {
            console.error("Firestore lookup failed", e);
            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = { ...next[index], loadingFirestore: false, loadingImage: false };
                }
                return next;
            });
        }
    };

    const itemsPerPage = layoutConfig.columns * layoutConfig.rows;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const pages = Array.from({ length: totalPages }, (_, i) => products.slice(i * itemsPerPage, (i + 1) * itemsPerPage));

    useEffect(() => {
        if (currentPreviewPage >= totalPages && totalPages > 0) {
            setCurrentPreviewPage(totalPages - 1);
        }
    }, [totalPages, currentPreviewPage]);

    return (
        <div className="fade-in" style={{ display: 'flex', height: 'calc(100vh - 80px)', gap: '1rem', overflow: 'hidden' }}>
            {/* Sidebar Controls */}
            <div className="glass-card" style={{ width: '350px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                {/* Tabs Header */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        className={`sidebar-tab ${activeTab === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveTab('products')}
                        style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'products' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'products' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'products' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                    >
                        <Type size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Productos
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => setActiveTab('theme')}
                        style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'theme' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'theme' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'theme' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                    >
                        <Layout size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Tema
                    </button>
                    {userData?.role === 'admin' && (
                        <button
                            className={`sidebar-tab ${activeTab === 'layout' ? 'active' : ''}`}
                            onClick={() => setActiveTab('layout')}
                            style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'layout' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'layout' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'layout' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                        >
                            <Settings size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Ajustes
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

                    {activeTab === 'products' && (
                        <div className="fade-in">
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Lista de Produtos</h3>

                            {/* Global Database Search */}
                            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                                    BUSCAR NO BANCO DE IMAGENS
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--primary-color)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem', borderColor: 'var(--primary-color)' }}
                                        placeholder="Digite nome ou EAN para buscar..."
                                        value={globalSearch}
                                        onChange={(e) => handleGlobalSearch(e.target.value)}
                                    />
                                    {searchingGlobal && <Loader2 size={14} className="loading-spinner" style={{ position: 'absolute', right: '10px', top: '11px', color: 'var(--primary-color)' }} />}
                                </div>

                                {globalResults.length > 0 && (
                                    <div className="glass-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', padding: '4px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                        {globalResults.map((p, i) => (
                                            <div
                                                key={i}
                                                onClick={() => addProductToList(p)}
                                                style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ width: '24px', height: '24px', background: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                    <img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{p.ean}</div>
                                                </div>
                                                <Plus size={14} style={{ color: 'var(--primary-color)' }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Cole sua lista abaixo. Ex: "Arroz Branco 5kg R$ 25,90"
                            </p>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.5' }}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="7891234567890 Café Pilão 500g R$ 15,90&#10;Sabão em Pó Omo 1kg R$ 12,99"
                            />
                            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={processInput}>
                                <Layers size={18} /> Processar Produtos
                            </button>

                            {products.length > 0 && (
                                <div style={{ marginTop: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                            {filterOnlyMissing ? `${unavailableProducts.length} Itens pendentes` : `${products.length} Itens detectados`}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={handleCopyAllAsTable}
                                                className="btn-secondary"
                                                style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title="Copiar todos como tabela"
                                            >
                                                <Copy size={12} /> Tabela
                                            </button>
                                            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setProducts([])}>Limpar</button>
                                        </div>
                                    </div>

                                    {unavailableProducts.length > 0 && (
                                        <div style={{ padding: '0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#92400e' }}>
                                                <AlertTriangle size={16} />
                                                <span>{unavailableProducts.length} itens sem imagem.</span>
                                            </div>
                                            <button
                                                onClick={() => setFilterOnlyMissing(!filterOnlyMissing)}
                                                style={{ background: 'none', border: 'none', color: '#b45309', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                {filterOnlyMissing ? 'Ver Todos' : 'Filtrar Faltantes'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Request button restricted to unlinked items WITH ean */}
                                    {unavailableProducts.some(p => !!p.ean) && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.8rem', fontSize: '0.9rem' }}
                                            onClick={handleRequestImages}
                                            disabled={requestingImages}
                                        >
                                            {requestingImages ? <Loader2 className="loading-spinner" /> : <ImagePlus size={18} />}
                                            {`Solicitar ${unavailableProducts.filter(p => !!p.ean).length} Imagens`}
                                        </button>
                                    )}

                                    {/* Product Search */}
                                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
                                            placeholder="Buscar na lista (nome ou código)..."
                                            value={productSearchTerm}
                                            onChange={(e) => setProductSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {products
                                            .filter(p => {
                                                const matchesSearch =
                                                    p.description.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                                    (p.ean || '').includes(productSearchTerm) ||
                                                    (p.internalCode || '').includes(productSearchTerm);

                                                const matchesMissing = filterOnlyMissing ? (!p.isLinked) : true;

                                                return matchesSearch && matchesMissing;
                                            })
                                            .map((p, i) => (
                                                <div key={p.id} style={{
                                                    padding: '0.6rem',
                                                    background: !p.isLinked ? '#fff1f1' : '#f8fafc',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    border: !p.isLinked ? '1px solid #fecaca' : '1px solid var(--border-color)',
                                                    opacity: p.loadingFirestore ? 0.6 : 1
                                                }}>
                                                    <div style={{ width: 34, height: 34, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {p.imageUrl ? (
                                                            <img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <ImageIcon size={16} color="#94a3b8" />
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: !p.isLinked ? '#991b1b' : 'inherit' }}>
                                                            {p.description}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px', alignItems: 'flex-end' }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{p.price}</span>
                                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', opacity: 0.6, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                                                {p.internalCode && <span>Cód: {p.internalCode}</span>}
                                                                {p.ean && <span>{p.ean}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {p.loadingFirestore ? (
                                                        <Loader2 size={14} className="loading-spinner" style={{ color: 'var(--primary-color)' }} />
                                                    ) : !p.isLinked ? (
                                                        <div title="Imagem pendente" style={{ color: '#ef4444' }}>
                                                            <AlertCircle size={14} />
                                                        </div>
                                                    ) : (
                                                        <div title="Imagem vinculada" style={{ color: '#22c55e' }}>
                                                            <Check size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'theme' && (
                        <div className="fade-in">
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Escolha um Tema</h3>

                            {/* Filtro de Temas */}
                            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
                                    placeholder="Buscar por nome ou tag..."
                                    value={themeSearch}
                                    onChange={e => setThemeSearch(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {themes.filter(t =>
                                    t.name.toLowerCase().includes(themeSearch.toLowerCase()) ||
                                    (t.tags || []).some(tag => tag.toLowerCase().includes(themeSearch.toLowerCase()))
                                ).map(theme => (
                                    <div
                                        key={theme.id}
                                        onClick={() => setSelectedTheme(theme)}
                                        style={{
                                            border: selectedTheme?.id === theme.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            position: 'relative'
                                        }}
                                    >
                                        <div style={{ height: '100px', background: '#e2e8f0', position: 'relative' }}>
                                            <img src={theme.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                                            <div style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: '4px' }}>
                                                {!theme.isPublic && theme.companyId !== userData?.companyId && (
                                                    <span style={{ fontSize: '0.6rem', background: 'var(--primary-color)', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>Interno</span>
                                                )}
                                            </div>


                                        </div>
                                        <div style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}>
                                            {theme.name}
                                        </div>
                                    </div>
                                ))}
                                {themes.length === 0 && !loadingThemes && (
                                    <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Nenhum tema para encartes disponível. Crie um no módulo de Temas.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'layout' && userData?.role === 'admin' && (
                        <div className="fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Configurações</h3>
                                {selectedTheme && (
                                    <button onClick={handleSaveThemeConfig} className="btn-icon" title="Salvar ajustes neste tema" style={{ color: 'var(--primary-color)' }}>
                                        <Save size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Section: Cores */}
                            <details className="settings-group" open>
                                <summary>Cores</summary>
                                <div className="settings-content">
                                    <div className="form-group row">
                                        <label>Descrição</label>
                                        <input type="color" value={layoutConfig.colorDescription} onChange={e => setLayoutConfig({ ...layoutConfig, colorDescription: e.target.value })} />
                                    </div>
                                    <div className="form-group row">
                                        <label>Preço</label>
                                        <input type="color" value={layoutConfig.colorPrice} onChange={e => setLayoutConfig({ ...layoutConfig, colorPrice: e.target.value })} />
                                    </div>
                                    <div className="form-group row">
                                        <label>Cód. Interno</label>
                                        <input type="color" value={layoutConfig.colorInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, colorInternalCode: e.target.value })} />
                                    </div>
                                    <div className="form-group row">
                                        <label>EAN</label>
                                        <input type="color" value={layoutConfig.colorEan} onChange={e => setLayoutConfig({ ...layoutConfig, colorEan: e.target.value })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Ordem dos Elementos */}
                            <details className="settings-group">
                                <summary>Ordem dos Textos</summary>
                                <div className="settings-content">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
                                        {(layoutConfig.elementsOrder || ['code', 'description', 'price']).map((item, index) => (
                                            <div
                                                key={item}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    background: 'var(--surface-color)',
                                                    padding: '10px 14px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            >
                                                <Grid size={16} color="var(--text-muted)" />
                                                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {item === 'code' ? 'Códigos (Cód/EAN)' : item === 'description' ? 'Descrição do Produto' : 'Preço Principal'}
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
                                                        className="btn-icon" style={{ width: 24, height: 24, padding: 0, opacity: index === 0 ? 0.3 : 1 }}
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
                                                        className="btn-icon" style={{ width: 24, height: 24, padding: 0, opacity: index === ((layoutConfig.elementsOrder?.length || 3) - 1) ? 0.3 : 1 }}
                                                    >
                                                        <ChevronDown size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                        Use as setas para definir a ordem dos elementos no card.
                                    </p>
                                </div>
                            </details>

                            {/* Section: Layout */}
                            <details className="settings-group">
                                <summary>Layout (Grade e Margens)</summary>
                                <div className="settings-content">
                                    <div className="form-group">
                                        <label>Colunas: {layoutConfig.columns}</label>
                                        <input type="range" min="1" max="6" value={layoutConfig.columns} onChange={e => setLayoutConfig({ ...layoutConfig, columns: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Linhas: {layoutConfig.rows}</label>
                                        <input type="range" min="1" max="8" value={layoutConfig.rows} onChange={e => setLayoutConfig({ ...layoutConfig, rows: Number(e.target.value) })} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                        <div><label>Topo (mm)</label><input className="form-input" type="number" value={layoutConfig.marginTop} onChange={e => setLayoutConfig({ ...layoutConfig, marginTop: Number(e.target.value) })} /></div>
                                        <div><label>Base (mm)</label><input className="form-input" type="number" value={layoutConfig.marginBottom} onChange={e => setLayoutConfig({ ...layoutConfig, marginBottom: Number(e.target.value) })} /></div>
                                        <div><label>Esq (mm)</label><input className="form-input" type="number" value={layoutConfig.marginLeft} onChange={e => setLayoutConfig({ ...layoutConfig, marginLeft: Number(e.target.value) })} /></div>
                                        <div><label>Dir (mm)</label><input className="form-input" type="number" value={layoutConfig.marginRight} onChange={e => setLayoutConfig({ ...layoutConfig, marginRight: Number(e.target.value) })} /></div>
                                    </div>
                                </div>
                            </details>

                            {/* Section: Espaçamentos (Card) */}
                            <details className="settings-group">
                                <summary>Espaçamentos (Card)</summary>
                                <div className="settings-content">
                                    <div className="form-group">
                                        <label>Gap da Grade (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.gap} onChange={e => setLayoutConfig({ ...layoutConfig, gap: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Abaixo da Foto (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.spacingBelowPhoto} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowPhoto: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Abaixo da Descrição (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.spacingBelowDescription} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowDescription: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Acima do Preço (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.spacingAbovePrice} onChange={e => setLayoutConfig({ ...layoutConfig, spacingAbovePrice: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Ajustes da Foto */}
                            <details className="settings-group">
                                <summary>Ajustes da Foto</summary>
                                <div className="settings-content">
                                    <div className="form-group">
                                        <label>Escala (%): {Math.round(layoutConfig.photoScale * 100)}</label>
                                        <input type="range" min="0" max="1.5" step="0.05" value={layoutConfig.photoScale} onChange={e => setLayoutConfig({ ...layoutConfig, photoScale: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Ajustes de Tipografia */}
                            <details className="settings-group">
                                <summary>Ajustes de Tipografia</summary>
                                <div className="settings-content">
                                    <div className="form-group">
                                        <label>Tamanho Descrição (rem)</label>
                                        <input className="form-input" type="number" step="0.1" value={layoutConfig.fontSizeDescription} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeDescription: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tamanho Preço (rem)</label>
                                        <input className="form-input" type="number" step="0.1" value={layoutConfig.fontSizePrice} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizePrice: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group row">
                                        <label>Mostrar Selo de Preço</label>
                                        <input type="checkbox" checked={layoutConfig.showPriceSeal} onChange={e => setLayoutConfig({ ...layoutConfig, showPriceSeal: e.target.checked })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Ajustes dos Códigos */}
                            <details className="settings-group">
                                <summary>Ajustes dos Códigos</summary>
                                <div className="settings-content">
                                    <div className="form-group row">
                                        <label>Mostrar Cód. Interno</label>
                                        <input type="checkbox" checked={layoutConfig.showInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, showInternalCode: e.target.checked })} />
                                    </div>
                                    <div className="form-group row">
                                        <label>Mostrar EAN</label>
                                        <input type="checkbox" checked={layoutConfig.showEan} onChange={e => setLayoutConfig({ ...layoutConfig, showEan: e.target.checked })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Fonte Cód. Interno (rem)</label>
                                        <input className="form-input" type="number" step="0.1" value={layoutConfig.fontInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, fontInternalCode: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Fundo do Card */}
                            <details className="settings-group">
                                <summary>Fundo do Card</summary>
                                <div className="settings-content">
                                    <div className="form-group">
                                        <label>Modo</label>
                                        <select className="form-input" value={layoutConfig.cardBackgroundMode} onChange={e => setLayoutConfig({ ...layoutConfig, cardBackgroundMode: e.target.value })} >
                                            <option value="none">Nenhum</option>
                                            <option value="white">Branco</option>
                                            <option value="gradient">Gradiente Suave</option>
                                            <option value="glass">Glass</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Opacidade: {layoutConfig.cardOpacity}</label>
                                        <input type="range" min="0" max="1" step="0.1" value={layoutConfig.cardOpacity} onChange={e => setLayoutConfig({ ...layoutConfig, cardOpacity: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Arredondamento (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.cardRadius} onChange={e => setLayoutConfig({ ...layoutConfig, cardRadius: Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Padding (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.cardPadding} onChange={e => setLayoutConfig({ ...layoutConfig, cardPadding: Number(e.target.value) })} />
                                    </div>
                                </div>
                            </details>

                            {/* Section: Camadas */}
                            <details className="settings-group">
                                <summary>Camadas (Globais)</summary>
                                <div className="settings-content">
                                    <h5 style={{ marginBottom: 10, marginTop: 10 }}>Logo da Empresa</h5>
                                    <div className="form-group row">
                                        <label>Mostrar Logo</label>
                                        <input type="checkbox" checked={layoutConfig.logoConfig?.visible ?? true} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig!, visible: e.target.checked } })} />
                                    </div>
                                    <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                        <div><label>Pos X (%)</label><input className="form-input" type="number" step="0.1" value={layoutConfig.logoConfig?.x ?? 0} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig!, x: Number(e.target.value) } })} /></div>
                                        <div><label>Pos Y (%)</label><input className="form-input" type="number" step="1" value={layoutConfig.logoConfig?.y ?? 0} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig!, y: Number(e.target.value) } })} /></div>
                                    </div>
                                    <div className="form-group">
                                        <label>Escala</label>
                                        <input className="form-input" type="number" step="0.1" value={layoutConfig.logoConfig?.scale ?? 1} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig!, scale: Number(e.target.value) } })} />
                                    </div>

                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '15px 0' }}></div>

                                    <h5 style={{ marginBottom: 10, marginTop: 10 }}>Texto Lateral</h5>
                                    <div className="form-group row">
                                        <label>Mostrar Texto</label>
                                        <input type="checkbox" checked={layoutConfig.sideTextConfig.visible} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, visible: e.target.checked } })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tam. Fonte (px)</label>
                                        <input className="form-input" type="number" value={layoutConfig.sideTextConfig.fontSize} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, fontSize: Number(e.target.value) } })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Texto</label>
                                        <input className="form-input" type="text" value={layoutConfig.sideTextConfig.text} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, text: e.target.value } })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Cor Texto</label>
                                        <input type="color" value={layoutConfig.sideTextConfig.color} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, color: e.target.value } })} />
                                    </div>
                                    <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                        <div><label>Pos X (%)</label><input className="form-input" type="number" value={layoutConfig.sideTextConfig.x} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, x: Number(e.target.value) } })} /></div>
                                        <div><label>Pos Y (%)</label><input className="form-input" type="number" value={layoutConfig.sideTextConfig.y} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, y: Number(e.target.value) } })} /></div>
                                    </div>
                                    <div className="form-group">
                                        <label>Rotação (graus)</label>
                                        <input className="form-input" type="number" value={layoutConfig.sideTextConfig.rotation} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, rotation: Number(e.target.value) } })} />
                                    </div>
                                </div>
                            </details>


                            <style>{`
                                .settings-group {
                                    border-bottom: 1px solid var(--border-color);
                                }
                                .settings-group summary {
                                    padding: 1rem 0;
                                    cursor: pointer;
                                    font-weight: 600;
                                    list-style: none; /* Hide default triangle */
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                }
                                .settings-group summary::after {
                                    content: '+';
                                    font-weight: bold;
                                }
                                .settings-group[open] summary::after {
                                    content: '-';
                                }
                                .settings-content {
                                    padding-bottom: 1.5rem;
                                    padding-left: 0.5rem;
                                }
                                .form-group.row {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    margin-bottom: 0.5rem;
                                }
                                .form-group input[type="color"] {
                                    width: 40px;
                                    height: 30px;
                                    padding: 0;
                                    border: none;
                                    background: none;
                                }
                            `}</style>

                        </div>
                    )}

                </div>

                {/* Footer Action */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'space-between' }}
                            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                            disabled={pages.length === 0 || isExporting}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={18} /> {isExporting ? 'Gerando...' : 'Baixar Encarte'}
                            </span>
                            <ChevronDown size={18} />
                        </button>
                        {showDownloadMenu && (
                            <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                width: '100%',
                                background: 'white',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                marginBottom: '8px',
                                overflow: 'hidden',
                                zIndex: 100
                            }}>
                                <button className="dropdown-item" onClick={() => handleExport('jpg-current')}>JPG (Página Atual)</button>
                                <button className="dropdown-item" onClick={() => handleExport('jpg-all')}>JPG (Todas - Zip)</button>
                                <div style={{ height: 1, background: '#eee', margin: '4px 0' }} />
                                <button className="dropdown-item" onClick={() => handleExport('pdf-current')}>PDF (Página Atual)</button>
                                <button className="dropdown-item" onClick={() => handleExport('pdf-all')}>PDF (Completo)</button>
                            </div>
                        )}
                        <style>{`
                            .dropdown-item {
                                display: block;
                                width: 100%;
                                text-align: left;
                                padding: 10px 16px;
                                background: none;
                                border: none;
                                cursor: pointer;
                                font-size: 0.9rem;
                                color: var(--text-color);
                            }
                            .dropdown-item:hover {
                                background: var(--surface-color);
                            }
                        `}</style>
                    </div>
                </div>
            </div>

            {/* Preview Area (Main) */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

                {pages.length > 0 && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                        {/* Pagination Controls */}
                        <div className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem 1rem' }}>
                            <button className="btn-icon" onClick={() => setCurrentPreviewPage(0)} disabled={currentPreviewPage === 0}><ChevronsLeft size={20} /></button>
                            <button className="btn-icon" onClick={() => setCurrentPreviewPage(p => Math.max(0, p - 1))} disabled={currentPreviewPage === 0}><ChevronLeft size={20} /></button>
                            <span style={{ fontWeight: 600, minWidth: '80px', textAlign: 'center' }}>Página {currentPreviewPage + 1} de {totalPages}</span>
                            <button className="btn-icon" onClick={() => setCurrentPreviewPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPreviewPage === totalPages - 1}><ChevronRight size={20} /></button>
                            <button className="btn-icon" onClick={() => setCurrentPreviewPage(totalPages - 1)} disabled={currentPreviewPage === totalPages - 1}><ChevronsRight size={20} /></button>
                        </div>

                        {/* Zoom Controls */}
                        <div className="glass-card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem' }}>
                            <button className="btn-icon" onClick={() => handleZoomChange(zoomLevel - 0.1)}><ZoomOut size={18} /></button>
                            <span style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center', fontSize: '0.8rem' }}>{Math.round(zoomLevel * 100)}%</span>
                            <button className="btn-icon" onClick={() => handleZoomChange(zoomLevel + 0.1)}><ZoomIn size={18} /></button>
                        </div>
                    </div>
                )}

                {pages.map((pageProducts, pageIndex) => {
                    if (pageIndex !== currentPreviewPage) return null; // Show only current page

                    return (
                        <FlyerPage
                            key={pageIndex}
                            products={pageProducts}
                            pageIndex={pageIndex}
                            theme={selectedTheme}
                            layoutConfig={layoutConfig}
                            companyLogoUrl={companyLogoUrl}
                            scale={zoomLevel} // Use the zoom level
                            className="flyer-page-preview"
                            style={{
                                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                marginBottom: `${(297 * zoomLevel) - 297}mm`, // Compensate for scale transform origin top
                                border: '1px solid #e2e8f0'
                            }}
                        />
                    );
                })}

                {/* Export Orchestrator */}
                <FlyerExportOrchestrator
                    ref={orchestratorRef}
                    pages={pages}
                    theme={selectedTheme}
                    layoutConfig={layoutConfig}
                    companyLogoUrl={companyLogoUrl}
                    onExportStart={() => setIsExporting(true)}
                    onExportEnd={() => setIsExporting(false)}
                />


                {pages.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', marginTop: '5rem' }}>
                        Adicione produtos e processe para visualizar o encarte.
                    </div>
                )}
            </div>
        </div >
    );
};

export default FlyersModule;
