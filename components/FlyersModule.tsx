import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
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
    ChevronDown // Added for dropdown
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

    // Theme
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
    const [loadingThemes, setLoadingThemes] = useState(false);

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
        }
    });

    const productsProcessedRef = useRef(false);

    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

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

    const fetchThemes = async () => {
        setLoadingThemes(true);
        try {
            // Fetch themes available for 'encartes'
            const q = query(collection(db, 'themes'), where('availability', 'array-contains', 'encartes'));
            // Note: In real app we also need to filter by companyId or isPublic. 
            // For prototype simplifying to just checking availability and then filtering in memory if needed or improving query.
            const snapshot = await getDocs(q);

            const fetchedThemes: Theme[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.isPublic || data.companyId === userData?.companyId) {
                    fetchedThemes.push({ id: doc.id, ...data } as Theme);
                }
            });

            setThemes(fetchedThemes);
            if (fetchedThemes.length > 0) {
                setSelectedTheme(fetchedThemes[0]);
            }
        } catch (error) {
            console.error("Error fetching themes:", error);
        } finally {
            setLoadingThemes(false);
        }
    };

    useEffect(() => {
        if (selectedTheme && selectedTheme.defaultLayoutConfig) {
            // Merge with defaults to ensure all keys exist even if user has an old config
            setLayoutConfig(prev => ({ ...prev, ...selectedTheme.defaultLayoutConfig }));
        }
    }, [selectedTheme]);

    const handleSaveThemeConfig = async () => {
        if (!selectedTheme) return;

        // Safety check: Don't let users edit public themes if they are not admin (simplified here by assumes user can edit if they see the button OR we check ownership)
        // In this prototype, we'll allow saving if it's the selected theme. 
        // Ideally we should check if data.companyId === userData.companyId

        try {
            const themeRef = doc(db, 'themes', selectedTheme.id);
            await updateDoc(themeRef, {
                defaultLayoutConfig: layoutConfig
            });

            // Update local state
            setSelectedTheme(prev => prev ? { ...prev, defaultLayoutConfig: layoutConfig } : null);
            setThemes(prev => prev.map(t => t.id === selectedTheme.id ? { ...t, defaultLayoutConfig: layoutConfig } : t));

            alert('Configurações salvas no tema com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar configurações do tema:", error);
            alert('Erro ao salvar configurações.');
        }
    };

    const handleDuplicateTheme = async (e: React.MouseEvent, theme: Theme) => {
        e.stopPropagation(); // Prevent selection
        if (userData?.role !== 'admin' || !userData?.companyId) return;

        if (!confirm('Deseja duplicar este tema? As configurações serão mantidas, mas sem as imagens de fundo.')) return;

        try {
            const newThemeData = {
                name: `${theme.name} (Cópia)`,
                companyId: userData.companyId,
                availability: theme.availability || ['encartes'],
                backgroundEncartes: '', // Clear images as requested
                priceSealUrl: '',
                defaultLayoutConfig: theme.defaultLayoutConfig || {},
                isPublic: false,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'themes'), newThemeData);
            alert('Tema duplicado com sucesso!');
            fetchThemes(); // Refresh list
        } catch (error) {
            console.error("Erro ao duplicar tema:", error);
            alert('Erro ao duplicar tema.');
        }
    };

    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const orchestratorRef = useRef<FlyerExportOrchestratorRef>(null);

    // Export Logic
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

    // Parse Text Input
    const processInput = async () => {
        if (!inputText.trim()) return;

        const lines = inputText.split('\n').filter(l => l.trim());
        const newProducts: ProductItem[] = lines.map((line, index) => {
            let description = line;
            let price = '';
            let ean = '';
            let internalCode = '';

            // 1. Extract Price (R$ XX,XX or XX,XX)
            const priceMatch = line.match(/(?:R\$\s*)?(\d+[.,]\d{2})(?!\d)/);
            if (priceMatch) {
                price = priceMatch[0];
                description = description.replace(priceMatch[0], '').trim();
            }

            // 2. Extract Identifier (EAN or Internal Code)
            const ean13Match = line.match(/(\d{8,14})/);
            const startCodeMatch = line.match(/^(\d+)/);

            if (ean13Match) {
                ean = ean13Match[0];
                description = description.replace(ean, '').trim();
            }

            if (startCodeMatch) {
                const possibleCode = startCodeMatch[0];
                // If the start code matches the found EAN, then it's just the EAN
                // Otherwise (or if no EAN found), it's the internal code
                if (possibleCode !== ean) {
                    internalCode = possibleCode;
                    description = description.replace(new RegExp(`^${internalCode}`), '').trim();
                }
            }

            // Clean description
            description = description.replace(/^[-–\s]+|[-–\s]+$/g, '').trim();

            const candidates: string[] = [];
            // Optimistically add external sources if EAN is valid
            if (ean) {
                // Priority A: CanvaZap
                candidates.push(`http://imagens.canvazap.com.br/codbarras/${ean}.png`);
                // Priority B: Bluesoft Cosmos
                candidates.push(`http://cdn-cosmos.bluesoft.com.br/products/${ean}`);
            }

            return {
                id: `p-${Date.now()}-${index}`,
                rawText: line,
                description: description || 'Sem descrição',
                price: price || 'R$ 0,00',
                ean, // May be empty
                internalCode, // New field for internal code
                candidateUrls: candidates,
                loadingFirestore: true,
                isLinked: !!ean // True if we have an EAN, otherwise false (needs lookup)
            };
        });

        setProducts(newProducts);
        setActiveTab('theme'); // Auto advance
        setCurrentPreviewPage(0); // Reset page

        // Async: Check Firestore for each product
        for (let i = 0; i < newProducts.length; i++) {
            checkFirestoreForProduct(newProducts[i], i);
        }
    };

    const checkFirestoreForProduct = async (product: ProductItem, index: number) => {
        try {
            let foundData: any = null;
            let resolvedEan = product.ean;

            // 1. If we don't have an EAN, try to find it in 'product_mappings' (Company specific Code -> EAN)
            if (!resolvedEan && product.internalCode && userData?.companyId) {
                try {
                    const qMap = query(collection(db, 'product_mappings'),
                        where('companyId', '==', userData.companyId),
                        where('internalCode', '==', product.internalCode)
                    );
                    const snapMap = await getDocs(qMap);
                    if (!snapMap.empty) {
                        const mapData = snapMap.docs[0].data();
                        if (mapData.ean) {
                            resolvedEan = mapData.ean;
                        }
                    }
                } catch (err) {
                    console.error("Error checking mappings", err);
                }
            }

            // 2. Search for Image Data
            // Basic constraints (always filter by companyId if looking for private records)
            const baseConstraints = [];
            if (userData?.companyId) {
                baseConstraints.push(where('companyId', '==', userData.companyId));
            }

            // A. Search by EAN (global or local)
            if (resolvedEan) {
                // First try strictly global/public or just by EAN without company constraint?
                // For now, let's keep it simple: Look for ANY record with this EAN first.
                // If the user system relies on private products, we might need companyId. 
                // But usually, an image bank is shared.
                const qEan = query(collection(db, 'products'), where('ean', '==', resolvedEan));
                const snapEan = await getDocs(qEan);
                if (!snapEan.empty) {
                    foundData = snapEan.docs[0].data();
                } else {
                    // If not found globally, try with companyId constraint in case it's strictly private?
                    // Actually logic above covers 'any'. SnapEan covers both private and public if companyId is just a field.
                }
            }
            // B. Fallback: Search by Internal Code (Private items only)
            else if (product.internalCode) {
                const qCode = query(collection(db, 'products'), where('internalCode', '==', product.internalCode), ...baseConstraints);
                const snapCode = await getDocs(qCode);
                if (!snapCode.empty) foundData = snapCode.docs[0].data();
            }

            // 3. Update State
            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    // Determine Final EAN
                    const finalEan = next[index].ean || resolvedEan || (foundData ? foundData.ean : undefined);

                    // Helper to build candidates
                    let newCandidates = [...next[index].candidateUrls];

                    // Add DB Image URL
                    if (foundData && foundData.imageUrl && !newCandidates.includes(foundData.imageUrl)) {
                        newCandidates.push(foundData.imageUrl); // Push to end (fallback)
                    }

                    // Add External Sources if we have EAN now
                    if (finalEan) {
                        const ext1 = `http://cdn-cosmos.bluesoft.com.br/products/${finalEan}`;
                        const ext2 = `http://imagens.canvazap.com.br/codbarras/${finalEan}.png`;

                        if (!newCandidates.includes(ext1)) newCandidates.unshift(ext1);
                        if (!newCandidates.includes(ext2)) newCandidates.unshift(ext2);
                    }

                    next[index] = {
                        ...next[index],
                        ean: finalEan,
                        candidateUrls: newCandidates,
                        loadingFirestore: false,
                        isLinked: !!finalEan // Linked if we have EAN
                    };
                }
                return next;
            });

        } catch (e) {
            console.error("Firestore lookup failed", e);
            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = { ...next[index], loadingFirestore: false };
                }
                return next;
            });
        }
    };

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

    const searchImageForProduct = async (product: ProductItem, index: number) => {
        try {
            let imageUrl = '';
            let source: 'bank' | 'request' | 'upload' = 'request';

            // 1. Check External Sources if EAN exists
            if (product.ean) {
                // Priority A: CanvaZap
                const canvaZapUrl = `http://imagens.canvazap.com.br/codbarras/${product.ean}.png`;
                const canvaZapExists = await checkImageExists(canvaZapUrl);

                if (canvaZapExists) {
                    imageUrl = canvaZapUrl;
                    source = 'bank';
                } else {
                    // Priority B: Bluesoft Cosmos
                    const bluesoftUrl = `http://cdn-cosmos.bluesoft.com.br/products/${product.ean}`;
                    const bluesoftExists = await checkImageExists(bluesoftUrl);
                    if (bluesoftExists) {
                        imageUrl = bluesoftUrl;
                        source = 'bank';
                    }
                }
            }

            // 2. If not found externally, try Firestore 'products' collection
            if (!imageUrl && product.ean) {
                const qEan = query(collection(db, 'products'), where('ean', '==', product.ean));
                const snapEan = await getDocs(qEan);
                if (!snapEan.empty) {
                    const data = snapEan.docs[0].data();
                    if (data.imageUrl) {
                        imageUrl = data.imageUrl;
                        source = 'bank';
                    }
                }
            }

            // Update product in state
            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = { ...next[index], imageUrl, loadingImage: false, imageSource: source };
                }
                return next;
            });

        } catch (e) {
            console.error(e);
            setProducts(prev => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = { ...next[index], loadingImage: false };
                }
                return next;
            });
        }
    };

    // Calculate Layout
    const itemsPerPage = layoutConfig.columns * layoutConfig.rows;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const pages = Array.from({ length: totalPages }, (_, i) => products.slice(i * itemsPerPage, (i + 1) * itemsPerPage));

    // Reset page if out of bounds (e.g. changing layout)
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
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Lista de Produtos</h3>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <strong>{products.length} Itens detectados</strong>
                                        <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setProducts([])}>Limpar</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {products.some(p => !p.isLinked && !p.loadingFirestore && !p.ean) && (
                                            <div style={{ padding: '0.5rem', background: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                <AlertTriangle size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                                                Itens com ⚠️ precisam ser vinculados no Banco de Imagens.
                                            </div>
                                        )}
                                        {products.map((p, i) => (
                                            <div key={p.id} style={{ padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: 30, height: 30, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {/* We try to show first candidate or just icon */}
                                                    {p.candidateUrls.length > 0 ? (
                                                        <SmartImage urls={p.candidateUrls} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={<ImageIcon size={14} color="#94a3b8" />} />
                                                    ) : (
                                                        <ImageIcon size={14} color="#94a3b8" />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{p.description}</div>
                                                    <div style={{ color: 'var(--text-muted)' }}>{p.price}</div>
                                                </div>
                                                {/* Status Icons */}
                                                {!p.loadingFirestore && !p.isLinked && !p.ean && (
                                                    <div title="Este item não possui EAN nem vínculo no banco de imagens." style={{ color: 'orange' }}>
                                                        <AlertTriangle size={16} />
                                                    </div>
                                                )}
                                                {!p.imageUrl && !p.loadingImage && !p.loadingFirestore && p.ean && <AlertCircle size={14} color="#ccc" title="Imagem não encontrada" />}
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {themes.map(theme => (
                                    <div
                                        key={theme.id}
                                        onClick={() => setSelectedTheme(theme)}
                                        style={{
                                            border: selectedTheme?.id === theme.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        <div style={{ height: '100px', background: '#e2e8f0', position: 'relative' }}>
                                            <img src={theme.backgroundEncartes} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            {userData?.role === 'admin' && (
                                                <button
                                                    onClick={(e) => handleDuplicateTheme(e, theme)}
                                                    title="Duplicar Tema"
                                                    style={{ position: 'absolute', top: 5, right: 5, background: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                                >
                                                    <Copy size={14} color="#333" />
                                                </button>
                                            )}
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

                            {/* Section: Ajustes do Preço */}
                            <details className="settings-group">
                                <summary>Ajustes do Preço</summary>
                                <div className="settings-content">
                                    <div className="form-group row">
                                        <label>Mostrar Selo</label>
                                        <input type="checkbox" checked={layoutConfig.showPriceSeal} onChange={e => setLayoutConfig({ ...layoutConfig, showPriceSeal: e.target.checked })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tam. Fonte (rem)</label>
                                        <input className="form-input" type="number" step="0.1" value={layoutConfig.fontSizePrice} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizePrice: Number(e.target.value) })} />
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
                                        <div><label>Pos Y (px)</label><input className="form-input" type="number" step="1" value={layoutConfig.logoConfig?.y ?? 0} onChange={e => setLayoutConfig({ ...layoutConfig, logoConfig: { ...layoutConfig.logoConfig!, y: Number(e.target.value) } })} /></div>
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
                                        <div><label>Pos Y (px)</label><input className="form-input" type="number" value={layoutConfig.sideTextConfig.y} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, y: Number(e.target.value) } })} /></div>
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
