
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, writeBatch, arrayUnion, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { triggerWebhook } from '../services/WebhookService';
import { WebhookEvent } from '../types';
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
    Trophy,
    Table,
    Save,
    ChevronDown,
    Sparkles,
    Monitor
} from 'lucide-react';
import { ProductItem } from './FlyerTypes';
import { SmartImage } from './SmartImage';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { sanitizeAndNormalize } from '../utils/productUtils';

type SlideFormat = 'stories' | 'feed' | 'square' | 'tv';

interface LaminasModuleProps {
    isMasterMode?: boolean;
}

const LaminasModule: React.FC<LaminasModuleProps> = ({ isMasterMode = false }) => {
    const { userData } = useAuth();
    const [inputText, setInputText] = useState('');
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<SlideFormat>('stories');
    const [requestingImages, setRequestingImages] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const [activeTab, setActiveTab] = useState<'products' | 'ajustes'>('products');
    const [statusMessage, setStatusMessage] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [filterOnlyMissing, setFilterOnlyMissing] = useState(false);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
    const [logoVariations, setLogoVariations] = useState<string[]>([]);
    const [showLogoSelector, setShowLogoSelector] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [isRequestingCreation, setIsRequestingCreation] = useState(false);
    const [exportCompanyLogoUrl, setExportCompanyLogoUrl] = useState<string | null>(null);
    const [exportSealUrl, setExportSealUrl] = useState<string | null>(null);

    // Layout Configuration (Enriched for Advanced Mode)
    const [layoutConfig, setLayoutConfig] = useState({
        // General
        productScale: 1,
        productX: 50,
        productY: 50,
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
        priceCentsScale: 0.6,
        currencySymbolVisible: true,
        currencySymbolPosition: 'before', // 'before', 'superscript', 'subscript'
        currencySymbolScale: 0.7, // New Property

        // Descrição
        descVisible: true,
        descX: 50,
        descY: 20, // Distance from BOTTOM in %
        fontSizeDescription: 1.5,
        colorDescription: '#ffffff',

        // Texto Adicional (Solicitado via HTML)
        customText: 'Imagens meramente ilustrativas',
        customTextVisible: true,
        customTextSize: 15,
        customTextColor: '#EFEFEF',
        customTextX: 95, // Position X in % (vertical sidebar style)
        customTextY: 50, // Position Y in %
        customTextRotation: -90,

        // Marca d'água (codigodousuario)
        watermarkVisible: true,
        watermarkText: 'Agência D3',
        watermarkOpacity: 0.15,

        // Códigos
        showInternalCode: true,
        codeInternalX: 17,
        codeInternalY: 5, // Distance from BOTTOM in %
        fontSizeInternalCode: 1.4,
        colorInternalCode: '#ffffff',
        codeShadow: true,
        codeStroke: false,

        showEan: false,
        codeEanX: 81,
        codeEanY: 5, // Distance from BOTTOM in %
        fontSizeEan: 1.4,
        colorEan: '#ffffff',

        // Offsets individuais para partes do preço
        priceRealXOffset: 0,
        priceRealYOffset: 0,
        priceCentsXOffset: 0,
        priceCentsYOffset: 0,
        priceCurrencyXOffset: 0,
        priceCurrencyYOffset: 0,
        priceXOffset: 0,
        priceYOffset: 0,
        tvGradientVisible: false,
        tvGradientColor: '#000000',
        tvGradientDirection: 'right', // 'left' or 'right'

        // System Layers (Photoshop mode)
        layersOrder: ['codes', 'description', 'seal', 'logo', 'customText'] // Top is last
    });

    const [customSealUrl, setCustomSealUrl] = useState('');
    const [sealOptions, setSealOptions] = useState([
        'http://i.imgur.com/A5fwpMb.png',
        'https://i.imgur.com/vHqY7bM.png',
        'https://i.imgur.com/4S0tY0v.png',
        'https://i.imgur.com/7Yf8Y4v.png'
    ]);

    // Global Search
    const [globalSearch, setGlobalSearch] = useState('');
    const [globalResults, setGlobalResults] = useState<any[]>([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);

    useEffect(() => {
        loadThemeConfig();
    }, [userData, selectedFormat]);

    const loadThemeConfig = async () => {
        try {
            let finalConfig = { ...layoutConfig };

            // 1. Load GLOBAL Defaults (Master)
            try {
                const globalRef = doc(db, 'system_settings', 'laminas_module');
                const globalSnap = await getDoc(globalRef);
                if (globalSnap.exists()) {
                    const globalData = globalSnap.data();
                    if (globalData.layouts && globalData.layouts[selectedFormat]) {
                        finalConfig = { ...finalConfig, ...globalData.layouts[selectedFormat] };
                    }
                }
            } catch (err) {
                console.error("Error loading global config:", err);
            }

            // 2. Load Company Details (Logo, Variations, Name) if available
            // We load this even in Master Mode so the Admin can see a PREVIEW of how it looks with their company data
            if (userData?.companyId) {
                const compDoc = await getDoc(doc(db, 'companies', userData.companyId));
                if (compDoc.exists()) {
                    const data = compDoc.data();
                    setCompanyName(data.name || '');

                    // Logo Variations
                    const mainLogo = data.logoUrl || null;
                    const variations = data.logoVariations || [];
                    const variationsList = [mainLogo, ...variations].filter(Boolean) as string[];
                    setLogoVariations(variationsList);

                    const laminaPref = data.laminaLogoPreference;
                    if (laminaPref && variationsList.includes(laminaPref)) {
                        setCompanyLogoUrl(laminaPref);
                    } else if (mainLogo) {
                        setCompanyLogoUrl(mainLogo);
                    }

                    // 3. Load Layout Overrides (Only if NOT in Master Mode)
                    if (!isMasterMode) {
                        const overrides = data.temaLayoutOverrides?.['default']?.laminas?.[selectedFormat];
                        if (overrides) {
                            finalConfig = { ...finalConfig, ...overrides };
                        }
                    }
                }
            }

            setLayoutConfig(finalConfig);
        } catch (e) {
            console.error("Error loading layout config:", e);
        }
    };

    const handleSelectLogo = async (url: string) => {
        setCompanyLogoUrl(url);
        setShowLogoSelector(false);

        if (userData?.companyId) {
            try {
                const docRef = doc(db, 'companies', userData.companyId);
                await updateDoc(docRef, {
                    laminaLogoPreference: url
                });
            } catch (e) {
                console.error("Error saving lamina logo preference:", e);
            }
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
            const term = val.toLowerCase().trim();
            let results: any[] = [];

            // 1. Direct EAN Match
            if (/^\d{8,14}$/.test(term)) {
                const qEan = query(collection(db, 'products'), where('ean', '==', term), limit(5));
                const snapEan = await getDocs(qEan);
                results = snapEan.docs.map(doc => doc.data());
            }

            // 2. Internal Code Match (Company Specific)
            if (results.length === 0 && userData?.companyId && /^\d+$/.test(term)) {
                const qCode = query(
                    collection(db, 'products'),
                    where('companyId', '==', userData.companyId),
                    where('internalCode', '==', term),
                    limit(5)
                );
                const snapCode = await getDocs(qCode);
                const resCode = snapCode.docs.map(doc => doc.data());
                results = [...results, ...resCode];
            }

            // 3. Name Search (Standard Firestore Prefix)
            if (results.length === 0) {
                const q = query(
                    collection(db, 'products'),
                    where('name', '>=', term),
                    where('name', '<=', term + '\uf8ff'),
                    limit(15)
                );
                const snap = await getDocs(q);
                results = snap.docs.map(doc => doc.data());

                // Capitalized fallback
                if (results.length < 5) {
                    const capped = term.charAt(0).toUpperCase() + term.slice(1);
                    if (capped !== term) {
                        const q2 = query(
                            collection(db, 'products'),
                            where('name', '>=', capped),
                            where('name', '<=', capped + '\uf8ff'),
                            limit(15)
                        );
                        const snap2 = await getDocs(q2);
                        const res2 = snap2.docs.map(doc => doc.data());
                        results = [...results, ...res2];
                    }
                }
            }

            // 4. AI Smart Search Fallback
            // If we found nothing or very few results, and we have an API Key, let's try to be smart.
            if (results.length === 0 && userData?.openaiApiKey) {
                try {
                    // Quick classifier to find "clean" product name
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userData.openaiApiKey}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            messages: [
                                {
                                    role: "system",
                                    content: "You are a grocery product search assistant. Identify the core product name (official formatting) from the user input. Return ONLY the clean name."
                                },
                                {
                                    role: "user",
                                    content: `Input: ${val}. Clean Name:`
                                }
                            ],
                            max_tokens: 20
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const cleanName = data.choices[0]?.message?.content?.trim();
                        if (cleanName && cleanName.length > 3 && cleanName !== term) {
                            // Try searching with AI suggested name
                            // console.log("AI Suggested:", cleanName);
                            // Standard
                            const qAI = query(
                                collection(db, 'products'),
                                where('name', '>=', cleanName),
                                where('name', '<=', cleanName + '\uf8ff'),
                                limit(10)
                            );
                            const snapAI = await getDocs(qAI);
                            const resAI = snapAI.docs.map(doc => doc.data());
                            results = [...results, ...resAI];

                            // Capitalized AI
                            const cappedAI = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                            const qAI2 = query(
                                collection(db, 'products'),
                                where('name', '>=', cappedAI),
                                where('name', '<=', cappedAI + '\uf8ff'),
                                limit(10)
                            );
                            const snapAI2 = await getDocs(qAI2);
                            const resAI2 = snapAI2.docs.map(doc => doc.data());
                            results = [...results, ...resAI2];
                        }
                    }
                } catch (err) {
                    console.error("AI Search Error", err);
                }
            }

            // Deduplicate by EAN
            const seen = new Set();
            results = results.filter(r => {
                if (seen.has(r.ean)) return false;
                seen.add(r.ean);
                return true;
            }).slice(0, 10);

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
            // Improved Flexible Parser from User HTML
            let entry = line.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();

            // 1. Extrair Preço (última ocorrência de formato R$ XX.XX ou XX,XX)
            const priceRegex = /(?:\(?\s*(?:R\$)?\s*)(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})(?:\s*\)?)?/g;
            let priceMatch, lastPrice = null, priceMatches = [];
            while ((priceMatch = priceRegex.exec(entry)) !== null) { priceMatches.push(priceMatch); }
            if (priceMatches.length > 0) { lastPrice = priceMatches[priceMatches.length - 1][1]; }

            let precoFinal = '';
            if (lastPrice) {
                let n = lastPrice.replace(/\s/g, '');
                if (n.includes(',')) {
                    n = n.replace(/\.(?=\d{3}\b)/g, '');
                    n = n.replace(',', '.');
                }
                const num = Number.parseFloat(n);
                if (!isNaN(num)) precoFinal = num.toFixed(2);
            }

            // Limpa a linha para pegar descrição e código
            entry = entry.replace(priceRegex, ' ').replace(/\s{2,}/g, ' ').trim();

            // 2. Extrair Código (token de 4 a 14 dígitos)
            const codeRegex = /\b(\d{4,14})\b/;
            const codeMatch = entry.match(codeRegex);
            const codigo = codeMatch ? codeMatch[1] : null;

            // 3. Descrição (o que sobrar)
            let descBase = codigo ? entry.replace(new RegExp(`\\b${codigo}\\b`), ' ') : entry;
            let descricao = descBase.replace(/[()]/g, ' ').replace(/\s*[-–—]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

            // VALIDAÇÃO: Se não tem preço nem código, e a descrição é muito curta, ignorar
            if (!precoFinal && !codigo && (descricao.length < 5 || descricao.split(' ').length < 2)) {
                return null;
            }

            const normalized = sanitizeAndNormalize(descricao);

            return {
                id: `slide-${Date.now()}-${index}`,
                rawText: line,
                description: descricao || 'Produto sem descrição',
                normalizedDescription: normalized.normalizedDescription,
                price: precoFinal ? `R$ ${precoFinal.replace('.', ',')}` : '',
                ean: codigo && codigo.length >= 8 ? codigo : '',
                internalCode: codigo && codigo.length < 8 ? codigo : '',
                packaging: '',
                candidateUrls: (codigo && codigo.length >= 8) ? [
                    `https://imagens.canvazap.com.br/laminas/${codigo}.jpg`
                ] : [],
                loadingFirestore: true,
                isLinked: false
            };
        }).filter((p): p is ProductItem => p !== null);

        setProducts(parsedProducts);
        setActiveSlide(0);

        // Fetch each product info in parallel for maximum speed
        await Promise.all(parsedProducts.map((p, i) => checkProductInfo(p, i)));

        // After all checks, let's find the first one that actually has an image to set as active
        setProducts(currentProducts => {
            const firstLinked = currentProducts.findIndex(p => p.isLinked);
            if (firstLinked !== -1) {
                setActiveSlide(firstLinked);
            }
            return currentProducts;
        });

        setProcessing(false);
    };

    const checkProductInfo = async (p: ProductItem, index: number) => {
        let foundData: any = null;
        let finalEan = p.ean;

        // 1. Double check: If we have an internal code but no EAN, check company mappings first
        if (!finalEan && p.internalCode && userData?.companyId) {
            try {
                const qMap = query(collection(db, 'product_mappings'),
                    where('companyId', '==', userData.companyId),
                    where('internalCode', '==', p.internalCode)
                );
                const snapMap = await getDocs(qMap);
                if (!snapMap.empty) {
                    const mapData = snapMap.docs[0].data();
                    if (mapData.ean) finalEan = mapData.ean;
                }
            } catch (err) {
                console.error("Error checking mappings", err);
            }
        }

        // 2. Try search in products collection (Priority: Private > Global)
        if (finalEan) {
            // Try Private first
            if (userData?.companyId) {
                const privateId = `${userData.companyId}_${finalEan}`;
                const snapPriv = await getDoc(doc(db, 'products', privateId));
                if (snapPriv.exists()) foundData = snapPriv.data();
            }

            // Fallback to Global
            if (!foundData) {
                const qGlobal = query(collection(db, 'products'), where('ean', '==', finalEan), where('isGlobal', '==', true));
                const snapGlobal = await getDocs(qGlobal);
                if (!snapGlobal.empty) foundData = snapGlobal.docs[0].data();
            }
        }

        // 3. Fallback: search by internalCode in products collection (company specific)
        if (!foundData && p.internalCode && userData?.companyId) {
            const q = query(
                collection(db, 'products'),
                where('internalCode', '==', p.internalCode),
                where('companyId', '==', userData.companyId)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                foundData = snap.docs[0].data();
                if (!finalEan && foundData.ean) finalEan = foundData.ean;
            }
        }

        // 4. BIG FALLBACK: Search by description/name to find a matching barcode
        // Strict Mode: Only use description search if we absolutely DO NOT have an EAN.
        // If an EAN was provided (or mapped) and yielded no results, we stop there to avoid "inventing" images.
        if (!foundData && !finalEan && p.description && p.description.length > 5) {
            try {
                const term = p.description.toLowerCase().trim();
                const qDesc = query(
                    collection(db, 'products'),
                    limit(100) // Increased but still limited
                );
                const snapDesc = await getDocs(qDesc);
                const bestMatch = snapDesc.docs
                    .map(d => d.data())
                    .find(dp => {
                        const prodName = dp.name?.toLowerCase() || '';
                        if (prodName.length < 5) return false;
                        // Strict check: term must be almost equal or contain each other significantly
                        return prodName === term ||
                            (prodName.length > 5 && term.includes(prodName) && (term.length / prodName.length < 1.5)) ||
                            (term.length > 5 && prodName.includes(term) && (prodName.length / term.length < 1.5));
                    });

                if (bestMatch) {
                    foundData = bestMatch;
                    if (!finalEan && foundData.ean) finalEan = foundData.ean;
                }
            } catch (err) {
                console.error("Error in description fallback", err);
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
                const isRealMatch = isLinked && imageUrl && !imageUrl.includes('placeholder_laminas');
                next[index] = {
                    ...next[index],
                    imageUrl: isRealMatch ? imageUrl : '',
                    isLinked: isRealMatch,
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
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    const intermediador = async (url: string | null | undefined): Promise<string> => {
        if (!url || url.length < 5) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = '';
                resolve(url || '');
            }, 8000);
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&n=-1&output=png`;
            img.crossOrigin = "anonymous";
            img.onload = () => {
                clearTimeout(timeout);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    resolve(proxyUrl);
                }
            };
            img.onerror = () => {
                clearTimeout(timeout);
                resolve(url || '');
            };
            img.src = proxyUrl;
        });
    };

    const handleExportAll = async () => {
        if (products.length === 0) return;

        setProcessing(true);
        setStatusMessage("Iniciamos o download das suas lâminas...");
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

            const logoB64 = await intermediador(companyLogoUrl);
            const sealB64 = await intermediador(layoutConfig.sealUrl);
            setExportCompanyLogoUrl(logoB64);
            setExportSealUrl(sealB64);

            setStatusMessage("Não se preocupe! Estamos trabalhando em suas lâminas...");

            // Find index mapping since we iterate linked products but need full list index for state
            for (let p of linkedProducts) {
                const currentIndex = linkedProducts.indexOf(p) + 1;
                setStatusMessage(`Processando ${currentIndex}/${linkedProducts.length} lâminas...`);

                const idx = products.findIndex(item => item.id === p.id);
                const prodB64 = await intermediador(p.imageUrl);

                // Temporary update products state for export high-res
                setProducts(current => {
                    const next = [...current];
                    if (next[idx]) next[idx] = { ...next[idx], imageUrl: prodB64 };
                    return next;
                });

                setActiveSlide(idx);
                // ESPECIAL: Aguardar fontes e renderização (Layer 2)
                await document.fonts.ready;
                // Assentar layout (2 frames)
                await new Promise(r => requestAnimationFrame(r));
                await new Promise(r => requestAnimationFrame(r));
                await new Promise(r => setTimeout(r, 1000)); // Segurança adicional

                const canvas = await html2canvas(container, {
                    useCORS: true,
                    scale: 3, // ALTA RESOLUÇÃO
                    backgroundColor: null,
                    onclone: (clonedDoc, el) => {
                        const clonedEl = el as HTMLElement;

                        const body = clonedDoc.body;
                        body.style.fontSize = '16px';
                        (body.style as any).webkitFontSmoothing = 'antialiased';
                        (body.style as any).mozOsxFontSmoothing = 'grayscale';
                        // body.style.textRendering = 'geometricPrecision'; // Removido global

                        const root = clonedDoc.querySelector('[data-export-root="true"]') || clonedEl;

                        // Targeted Anti-clipping
                        const textNodes = root.querySelectorAll('[data-export-text="true"]');
                        textNodes.forEach((node: any) => {
                            node.style.setProperty('overflow', 'visible', 'important');
                            node.style.setProperty('display', 'block', 'important');

                            // Subimos até o topo do contêiner de exportação garantindo que nada corte
                            let p = node.parentElement;
                            while (p && p !== clonedDoc.body) {
                                p.style.setProperty('overflow', 'visible', 'important');
                                p = p.parentElement;
                            }
                        });
                    }
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
            setStatusMessage("Finalizando download...");
            saveAs(content, `laminas_${Date.now()}.zip`);

            // --- Stats Tracking ---
            try {
                await addDoc(collection(db, 'generated_assets'), {
                    type: 'lamina',
                    format: 'zip',
                    productCount: linkedProducts.length,
                    companyId: userData?.companyId || 'unknown',
                    userId: userData?.uid || 'unknown',
                    userName: userData?.name || 'unknown',
                    createdAt: serverTimestamp()
                });
            } catch (err) {
                console.error("Error tracking export stats", err);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao exportar imagens.");
        } finally {
            setExportCompanyLogoUrl(null);
            setExportSealUrl(null);
            setProcessing(false);
            setStatusMessage('');
        }
    };

    const handleSolicitarCriacao = async (missingItems: ProductItem[]) => {
        if (missingItems.length === 0 || isRequestingCreation) return;

        setIsRequestingCreation(true);

        try {
            // 1. Trigger Webhook via WebhookService
            if (userData?.companyId) {
                await triggerWebhook(userData.companyId, WebhookEvent.LAMINA_UPLOAD_REQUEST, {
                    solicitante: userData?.displayName || 'Usuário',
                    empresa: companyName || 'Empresa Não Identificada',
                    laminasSolicitadas: missingItems.map(item => ({
                        codigoInterno: item.internalCode || 'N/A',
                        descricao: item.description,
                        ean: item.ean || 'N/A'
                    }))
                });
            }

            // Legacy Webhook (keeping as secondary for now if needed, or remove if fully replaced)
            const legacyWebhookUrl = 'https://n8n.canvazap.com.br/webhook/82652ac0-6b40-4fe8-bbc3-3b876ad20553';
            // 1. Send Webhook
            const payload = {
                Solicitante: userData?.displayName || 'Usuário',
                Empresa: companyName || 'Empresa Não Identificada',
                "Laminas solicitadas": missingItems.map(item => ({
                    "Código interno": item.internalCode || 'N/A',
                    "Descrição": item.description,
                    "EAN": item.ean || 'N/A'
                }))
            };

            await fetch(legacyWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 2. Create Firestore Requests (Batch)
            const batch = writeBatch(db);
            missingItems.forEach(item => {
                const reqRef = doc(db, 'product_requests', item.ean || `req-${Date.now()}-${item.internalCode || 'raw'}`);
                batch.set(reqRef, {
                    ean: item.ean || '',
                    description: item.description,
                    internalCode: item.internalCode || '',
                    companyId: userData?.companyId || 'unknown',
                    companyName: companyName,
                    userName: userData?.displayName || 'Usuário',
                    status: 'pending',
                    type: 'laminas',
                    priority: 'high',
                    createdAt: serverTimestamp(),
                    lastRequestedAt: serverTimestamp(),
                    requesters: arrayUnion({
                        companyId: userData?.companyId || 'unknown',
                        companyName: companyName,
                        userName: userData?.displayName || 'Usuário',
                        requestedAt: new Date()
                    }),
                    needsSync: true
                }, { merge: true });

                // Notification for Admin
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    title: 'Nova Lâmina Solicitada',
                    message: `${companyName} solicitou criação de imagem: ${item.description}`,
                    type: 'product_request',
                    status: 'unread',
                    companyId: userData?.companyId,
                    createdAt: serverTimestamp(),
                    metadata: { ean: item.ean, internalCode: item.internalCode }
                });
            });

            await batch.commit();
            alert("Solicitação enviada com sucesso! Nossa equipe foi notificada.");
        } catch (error) {
            console.error("Erro ao solicitar criação:", error);
            alert("Ocorreu um erro ao enviar a solicitação. Tente novamente.");
        } finally {
            setIsRequestingCreation(false);
        }
    };

    const handleDownloadSingle = async (index: number) => {
        setActiveSlide(index);
        setProcessing(true);
        await new Promise(r => setTimeout(r, 800));
        const container = document.getElementById('laminas-export-container');
        if (!container) return;

        // Dynamic width for TV
        const exportWidth = selectedFormat === 'tv' ? '1920px' : '1080px';
        container.style.width = exportWidth;

        try {
            const canvas = await html2canvas(container, {
                useCORS: true,
                scale: 3,
                backgroundColor: null,
                onclone: (clonedDoc) => {
                    const textNodes = clonedDoc.querySelectorAll('[data-export-text="true"]');
                    textNodes.forEach((node: any) => {
                        node.style.setProperty('overflow', 'visible', 'important');
                        let p = node.parentElement;
                        while (p && p !== clonedDoc.body) {
                            p.style.setProperty('overflow', 'visible', 'important');
                            p = p.parentElement;
                        }
                    });
                }
            });
            canvas.toBlob(async (blob) => {
                if (blob) {
                    saveAs(blob, `lamina_${products[index].ean || index}.png`);

                    // --- Stats Tracking ---
                    try {
                        await addDoc(collection(db, 'generated_assets'), {
                            type: 'lamina',
                            format: 'single',
                            productCount: 1,
                            companyId: userData?.companyId || 'unknown',
                            userId: userData?.uid || 'unknown',
                            userName: userData?.name || 'unknown',
                            createdAt: serverTimestamp()
                        });
                    } catch (err) {
                        console.error("Error tracking export stats", err);
                    }
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveLayout = async () => {
        setProcessing(true);
        try {
            if (isMasterMode) {
                const globalRef = doc(db, 'system_settings', 'laminas_module');
                await setDoc(globalRef, {
                    layouts: {
                        [selectedFormat]: layoutConfig
                    }
                }, { merge: true });
                alert(`Configuração GLOBAL (Master) salva com sucesso para o formato: ${selectedFormat.toUpperCase()}! Todos os usuários que não personalizaram herdarão este layout.`);
            } else if (userData?.companyId) {
                const companyRef = doc(db, 'companies', userData.companyId);
                await updateDoc(companyRef, {
                    [`temaLayoutOverrides.default.laminas.${selectedFormat}`]: layoutConfig
                });
                alert("Layout salvo com sucesso para sua empresa!");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar layout.");
        } finally {
            setProcessing(false);
        }
    };

    const formatPrice = (priceStr: string) => {
        if (!priceStr) return null;
        const clean = priceStr.replace('R$', '').trim();
        const parts = clean.split(/[.,]/);
        if (parts.length === 1) return { int: parts[0], cents: '00' };
        return { int: parts[0], cents: parts[1].padEnd(2, '0').substring(0, 2) };
    };

    const foundCount = products.filter(p => p.isLinked).length;

    // Helper to render a lamina preview (used in grid)
    const renderLaminaPreview = (product: ProductItem, index: number, isThumbnail = false) => {
        if (!product) return null;

        // Exact ratios matching user request: Feed (1080x1350), Post (1080x1080), Stories (1080x1980)
        const getRatio = () => {
            if (selectedFormat === 'stories') return '1080/1980';
            if (selectedFormat === 'feed') return '1080/1350';
            if (selectedFormat === 'tv') return '1920/1080';
            return '1/1';
        };

        return (
            <div className={`aspect-ratio-box ${isThumbnail ? 'thumbnail' : ''}`} style={{
                aspectRatio: getRatio(),
                width: '100%',
                cursor: isThumbnail ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden', // Enforcing "closed box"
                backgroundColor: 'white' // Ensure it looks like a box even if image fails
            }} onClick={() => isThumbnail && setActiveSlide(index)}>
                <div className="slide-content">
                    {product.isLinked ? (
                        <>
                            {selectedFormat === 'tv' && layoutConfig.tvGradientVisible && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    background: layoutConfig.tvGradientDirection === 'right'
                                        ? `linear-gradient(to right, transparent 0%, ${layoutConfig.tvGradientColor} 100%)`
                                        : `linear-gradient(to left, transparent 0%, ${layoutConfig.tvGradientColor} 100%)`,
                                    zIndex: 1
                                }} />
                            )}
                            <img
                                src={product.imageUrl}
                                style={{
                                    width: `${(layoutConfig.productScale || 1) * 100}%`,
                                    height: `${(layoutConfig.productScale || 1) * 100}%`,
                                    objectFit: 'cover',
                                    transform: `translate(-50%, calc(-50% + ${layoutConfig.yOffset || 0}px))`, // Centered positioning for better "fill" control
                                    position: 'absolute',
                                    left: selectedFormat === 'tv' && layoutConfig.tvGradientVisible
                                        ? `${(layoutConfig.tvGradientDirection === 'right' ? 30 : 70) + ((layoutConfig.productX || 50) - 50)}%`
                                        : `${layoutConfig.productX || 50}%`,
                                    top: `${layoutConfig.productY || 50}%`,
                                    zIndex: 0
                                }}
                            />
                        </>
                    ) : (
                        <div className="placeholder-slide">
                            <ImageIcon size={isThumbnail ? 30 : 60} style={{ opacity: 0.1 }} />
                            <p style={{ fontSize: isThumbnail ? '0.6rem' : '0.8rem' }}>Sem Imagem</p>
                        </div>
                    )}

                    {/* Overlay Elements */}
                    <div className="overlay-layer">
                        {layoutConfig.logoVisible && (
                            (companyLogoUrl || exportCompanyLogoUrl || isMasterMode) ? (
                                <div style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.logoX ?? 50}%`,
                                    top: `${layoutConfig.logoY ?? 14}%`,
                                    transform: `translate(-50%, -50%) scale(${(layoutConfig.logoScale || 0.24) * (isThumbnail ? 4 : 8)})`,
                                    zIndex: (layoutConfig.layersOrder?.indexOf('logo') ?? 3) + 10,
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                                }}>
                                    <img
                                        src={exportCompanyLogoUrl || companyLogoUrl || 'https://via.placeholder.com/150x150/png?text=LOGO'}
                                        style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', display: 'block' }}
                                    />
                                </div>
                            ) : null
                        )}

                        {layoutConfig.sealVisible && (
                            <div style={{
                                position: 'absolute',
                                left: `${layoutConfig.sealX}%`,
                                top: `${layoutConfig.sealY}%`,
                                transform: `translate(-50%, -50%) scale(${layoutConfig.sealScale * (isThumbnail ? 3 : 5)})`,
                                zIndex: (layoutConfig.layersOrder?.indexOf('seal') ?? 2) + 10
                            }}>
                                <img src={exportSealUrl || layoutConfig.sealUrl} style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                                {layoutConfig.priceVisible && product.price && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${50 + (layoutConfig.priceXOffset || 0)}%`,
                                        top: `${50 + (layoutConfig.priceYOffset || 0)}%`,
                                        transform: `translate(-50%, -50%) scale(${layoutConfig.priceScale})`,
                                        color: layoutConfig.colorPrice,
                                        fontWeight: 950,
                                        fontSize: '1.4rem'
                                    }}>
                                        {(() => {
                                            const parts = formatPrice(product.price);
                                            if (!parts) return null;
                                            return (
                                                <div style={{ display: 'flex', flexDirection: layoutConfig.currencySymbolPosition === 'top' ? 'column' : 'row', alignItems: layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start'), lineHeight: 1 }}>
                                                    {layoutConfig.currencySymbolVisible && (
                                                        <span style={{
                                                            fontSize: `${layoutConfig.currencySymbolScale || 0.7}em`,
                                                            marginRight: layoutConfig.currencySymbolPosition === 'top' ? '0' : '2px',
                                                            marginBottom: layoutConfig.currencySymbolPosition === 'top' ? '-5px' : '0',
                                                            alignSelf: layoutConfig.currencySymbolPosition === 'before' ? 'center' : (layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start')),
                                                            marginTop: layoutConfig.currencySymbolPosition === 'superscript' ? '4px' : '0',
                                                            transform: `translate(${layoutConfig.priceCurrencyXOffset || 0}px, ${layoutConfig.priceCurrencyYOffset || 0}px)`,
                                                            display: 'inline-block'
                                                        }}>R$</span>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                        <span style={{ transform: `translate(${layoutConfig.priceRealXOffset || 0}px, ${layoutConfig.priceRealYOffset || 0}px)`, display: 'inline-block' }}>{parts.int}</span>
                                                        <span style={{
                                                            fontSize: `${layoutConfig.priceCentsScale || 0.6}em`,
                                                            marginTop: '2px',
                                                            transform: `translate(${layoutConfig.priceCentsXOffset || 0}px, ${layoutConfig.priceCentsYOffset || 0}px)`,
                                                            display: 'inline-block'
                                                        }}>,{parts.cents}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {!layoutConfig.sealVisible && layoutConfig.priceVisible && product.price && (
                            <div
                                data-export-text="true"
                                style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.priceX + (layoutConfig.priceXOffset || 0)}%`,
                                    top: `${layoutConfig.priceY + (layoutConfig.priceYOffset || 0)}%`,
                                    transform: `translate(-50%, -50%) scale(${layoutConfig.priceScale * (isThumbnail ? 1 : 1.5)})`,
                                    color: layoutConfig.colorPrice,
                                    fontWeight: 950,
                                    fontSize: '1.4rem'
                                }}
                            >
                                {(() => {
                                    const parts = formatPrice(product.price);
                                    if (!parts) return null;
                                    return (
                                        <div style={{ display: 'flex', flexDirection: layoutConfig.currencySymbolPosition === 'top' ? 'column' : 'row', alignItems: layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start'), lineHeight: 1 }}>
                                            {layoutConfig.currencySymbolVisible && (
                                                <span style={{
                                                    fontSize: `${layoutConfig.currencySymbolScale || 0.7}em`,
                                                    marginRight: layoutConfig.currencySymbolPosition === 'top' ? '0' : '2px',
                                                    marginBottom: layoutConfig.currencySymbolPosition === 'top' ? '-10px' : '0',
                                                    alignSelf: layoutConfig.currencySymbolPosition === 'before' ? 'center' : (layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start')),
                                                    marginTop: layoutConfig.currencySymbolPosition === 'superscript' ? '4px' : '0',
                                                    transform: `translate(${layoutConfig.priceCurrencyXOffset || 0}px, ${layoutConfig.priceCurrencyYOffset || 0}px)`,
                                                    display: 'inline-block'
                                                }}>R$</span>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                <span style={{ transform: `translate(${layoutConfig.priceRealXOffset || 0}px, ${layoutConfig.priceRealYOffset || 0}px)`, display: 'inline-block' }}>{parts.int}</span>
                                                <span style={{
                                                    fontSize: `${layoutConfig.priceCentsScale || 0.6}em`,
                                                    marginTop: '2px',
                                                    transform: `translate(${layoutConfig.priceCentsXOffset || 0}px, ${layoutConfig.priceCentsYOffset || 0}px)`,
                                                    display: 'inline-block'
                                                }}>,{parts.cents}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {layoutConfig.descVisible && (
                            <div
                                data-export-text="true"
                                style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.descX}%`,
                                    bottom: `${layoutConfig.descY}%`,
                                    transform: 'translateX(-50%)',
                                    color: layoutConfig.colorDescription,
                                    fontSize: (() => {
                                        const baseSize = layoutConfig.fontSizeDescription / (isThumbnail ? 4 : 2);
                                        const text = product.normalizedDescription || product.description || '';
                                        if (text.length > 60) return `${baseSize * 0.7}rem`;
                                        if (text.length > 40) return `${baseSize * 0.8}rem`;
                                        if (text.length > 25) return `${baseSize * 0.9}rem`;
                                        return `${baseSize}rem`;
                                    })(),
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    width: '90%',
                                    zIndex: (layoutConfig.layersOrder?.indexOf('description') ?? 1) + 10,
                                    height: 'auto',
                                    minHeight: `${(layoutConfig.fontSizeDescription / (isThumbnail ? 4 : 2)) * 1.5}rem`,
                                    lineHeight: '1.1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.1rem 0'
                                }}
                            >
                                <span style={{
                                    display: 'block',
                                    width: '100%',
                                    overflow: 'visible',
                                    wordBreak: 'break-word'
                                }}>
                                    {product.normalizedDescription || product.description}
                                </span>
                            </div>
                        )}

                        {layoutConfig.showInternalCode && product.internalCode && (
                            <div
                                data-export-text="true"
                                style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.codeInternalX}%`,
                                    bottom: `${layoutConfig.codeInternalY}%`,
                                    transform: 'translateX(-50%)',
                                    color: layoutConfig.colorInternalCode,
                                    fontSize: `${(layoutConfig.fontSizeInternalCode / (isThumbnail ? 4 : 2))}rem`,
                                    fontWeight: 700,
                                    zIndex: (layoutConfig.layersOrder?.indexOf('codes') ?? 0) + 10,
                                    textShadow: layoutConfig.codeShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                    WebkitTextStroke: layoutConfig.codeStroke ? `1px ${layoutConfig.colorInternalCode === '#ffffff' ? 'black' : 'white'}` : 'none'
                                }}
                            >
                                {product.internalCode}
                            </div>
                        )}

                        {layoutConfig.showEan && product.ean && (
                            <div
                                data-export-text="true"
                                style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.codeEanX}%`,
                                    bottom: `${layoutConfig.codeEanY}%`,
                                    transform: 'translateX(-50%)',
                                    color: layoutConfig.colorEan,
                                    fontSize: `${(layoutConfig.fontSizeEan / (isThumbnail ? 4 : 2))}rem`,
                                    fontWeight: 700,
                                    textShadow: layoutConfig.codeShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                                    WebkitTextStroke: layoutConfig.codeStroke ? `1px ${layoutConfig.colorEan === '#ffffff' ? 'black' : 'white'}` : 'none'
                                }}
                            >
                                {product.ean}
                            </div>
                        )}

                        {layoutConfig.customTextVisible && layoutConfig.customText && (
                            <div
                                data-export-text="true"
                                style={{
                                    position: 'absolute',
                                    left: `${layoutConfig.customTextX}%`,
                                    top: `${layoutConfig.customTextY}%`,
                                    transform: `translate(-50%, -50%) rotate(${layoutConfig.customTextRotation}deg)`,
                                    color: layoutConfig.customTextColor,
                                    fontSize: `${layoutConfig.customTextSize / (isThumbnail ? 40 : 20)}rem`,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    zIndex: (layoutConfig.layersOrder?.indexOf('customText') ?? 4) + 10,
                                    textTransform: 'uppercase'
                                }}
                            >
                                {layoutConfig.customText}
                            </div>
                        )}

                        {layoutConfig.watermarkVisible && (
                            <div style={{
                                position: 'absolute',
                                left: '4%',
                                top: '50%',
                                transform: 'translate(-50%, -50%) rotate(-90deg)',
                                color: '#efefef',
                                opacity: layoutConfig.watermarkOpacity,
                                fontSize: isThumbnail ? '0.4rem' : '0.8rem',
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                userSelect: 'none'
                            }}>
                                {userData?.displayName || layoutConfig.watermarkText} - CanvaZap
                            </div>
                        )}
                    </div>
                </div>

                {
                    isThumbnail && (
                        <button
                            className="btn-thumbnail-download"
                            onClick={(e) => { e.stopPropagation(); handleDownloadSingle(index); }}
                            style={{ position: 'absolute', bottom: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', zIndex: 120, cursor: 'pointer' }}
                        >
                            <DownloadCloud size={14} />
                        </button>
                    )
                }
            </div >
        );
    };

    return (
        <div className="fade-in module-container">
            {/* hidden container for high-res capture */}
            <div id="laminas-export-container" style={{
                position: 'fixed',
                left: '-9999px',
                top: 0,
                width: selectedFormat === 'tv' ? '1920px' : '1080px',
                zIndex: -1
            }}>
                {products.length > 0 && renderLaminaPreview(products[activeSlide], activeSlide)}
            </div>

            <div className="module-layout">
                {/* LEFT SIDEBAR */}
                {/* LEFT SIDEBAR */}
                <div className="module-sidebar glass-card" style={{ padding: 0, overflow: 'hidden' }}>

                    {/* Tabs Header */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            className={`sidebar-tab ${activeTab === 'products' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('products'); setIsEditingLayout(false); }}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: 'none',
                                background: activeTab === 'products' ? 'var(--surface-color)' : 'transparent',
                                fontWeight: 600,
                                borderBottom: activeTab === 'products' ? '2px solid var(--primary-color)' : 'none',
                                cursor: 'pointer',
                                color: activeTab === 'products' ? 'var(--primary-color)' : 'var(--text-secondary)'
                            }}
                        >
                            <Type size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Produtos
                        </button>
                        <button
                            className={`sidebar-tab ${activeTab === 'ajustes' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('ajustes'); setIsEditingLayout(true); }}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: 'none',
                                background: activeTab === 'ajustes' ? 'var(--surface-color)' : 'transparent',
                                fontWeight: 600,
                                borderBottom: activeTab === 'ajustes' ? '2px solid var(--primary-color)' : 'none',
                                cursor: 'pointer',
                                color: activeTab === 'ajustes' ? 'var(--primary-color)' : 'var(--text-secondary)'
                            }}
                        >
                            <Settings size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} />
                            {isMasterMode ? 'Baseline' : 'Tema'}
                        </button>
                    </div>

                    {/* Sidebar Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

                        {activeTab === 'products' && (
                            <>
                                <h2 className="title" style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>Lista de Produtos</h2>

                                {/* Formats moved here */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '1.5rem' }}>
                                    {[
                                        { id: 'feed', icon: Maximize, label: 'Feed' },
                                        { id: 'square', icon: Square, label: 'Post' },
                                        { id: 'stories', icon: Smartphone, label: 'Story' }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            className={`btn-secondary ${selectedFormat === f.id ? 'active' : ''}`}
                                            style={{ padding: '10px 4px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.65rem', borderRadius: '10px' }}
                                            onClick={() => setSelectedFormat(f.id as SlideFormat)}
                                        >
                                            <f.icon size={16} />
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Global Search - Search in Image Bank */}
                                <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>BUSCAR NO BANCO DE IMAGENS</span>
                                        {userData?.openaiApiKey && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.65rem' }}>
                                                <Sparkles size={12} /> IA Ativa
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: '2.5rem' }}
                                            placeholder="Busque por Nome, EAN ou Código Interno..."
                                            value={globalSearch}
                                            onChange={(e) => handleGlobalSearch(e.target.value)}
                                        />

                                        {searchingGlobal && (
                                            <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
                                                <Loader2 className="loading-spinner" size={16} />
                                            </div>
                                        )}

                                        {globalResults.length > 0 && (
                                            <div className="glass-card" style={{
                                                position: 'absolute',
                                                top: '110%',
                                                left: 0,
                                                right: 0,
                                                zIndex: 1000,
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                                padding: '0.5rem',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                                            }}>
                                                {globalResults.map((p, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="search-result-item"
                                                        onClick={() => addProductToList(p)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '0.5rem',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                                            {p.imageUrl ? <img src={p.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={18} color="#cbd5e1" />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.ean}</div>
                                                        </div>
                                                        <Plus size={16} color="var(--primary-color)" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <p className="subtitle" style={{ fontSize: '0.75rem' }}>
                                    Cole sua lista abaixo. Ex: "Arroz Branco 5kg R$ 25,90"
                                </p>
                                <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <textarea
                                        className="form-input"
                                        style={{ minHeight: '160px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                        placeholder="7891234567890 Café Pilão 500g R$ 15,90&#10;Sabão em Pó Omo 1kg R$ 12,99"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                    />
                                    <button className="btn btn-primary" style={{ marginTop: '1rem', padding: '12px' }} onClick={processInput} disabled={processing}>
                                        {processing ? <Loader2 className="loading-spinner" /> : (
                                            <>
                                                <Layers size={18} style={{ marginRight: '8px' }} />
                                                Processar Produtos
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Missing Items Block moved here */}
                                {products.length > 0 && foundCount !== products.length && (
                                    <div className="fade-in" style={{
                                        marginTop: '0.5rem',
                                        background: '#fff7ed',
                                        border: '1px solid #ffedd5',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        color: '#9a3412',
                                        animation: 'fadeIn 0.5s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
                                            <AlertTriangle size={20} color="#f97316" />
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>{products.length - foundCount} itens não encontrados</h3>
                                        </div>

                                        <div style={{ background: 'white', borderRadius: '8px', padding: '0.8rem', border: '1px solid #ffedd5', marginBottom: '1rem' }}>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {products.filter(p => !p.isLinked).map((p, idx) => (
                                                    <div key={idx} style={{ fontSize: '0.75rem', padding: '0.5rem', background: '#fffaf5', borderRadius: '4px', borderLeft: '3px solid #f97316' }}>
                                                        <div style={{ fontWeight: 700, lineHeight: 1.2, marginBottom: '2px' }}>{p.description}</div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                                            {p.internalCode ? `Cod: ${p.internalCode}` : ''} {p.ean ? `EAN: ${p.ean}` : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleSolicitarCriacao(products.filter(p => !p.isLinked))}
                                            disabled={isRequestingCreation}
                                            style={{
                                                background: '#f97316',
                                                borderColor: '#f97316',
                                                width: '100%',
                                                padding: '8px',
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {isRequestingCreation ? <Loader2 className="loading-spinner" size={16} /> : <Plus size={16} />}
                                            Solicitar criação
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'ajustes' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-color)' }}>Layout e Posicionamento</h3>
                                </div>

                                <div className="settings-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* PRODUCT IMAGE CONTROLS */}
                                    <details className="control-group" open>
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ImageIcon size={16} /> Imagem do Produto</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <div className="range-control">
                                                <div className="range-info"><span>Tamanho (Escala)</span> <span>{layoutConfig.productScale}</span></div>
                                                <input type="range" min="0.1" max="3" step="0.01" value={layoutConfig.productScale} onChange={e => setLayoutConfig({ ...layoutConfig, productScale: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição X (Horizontal)</span> <span>{layoutConfig.productX}%</span></div>
                                                <input type="range" min="0" max="100" step="1" value={layoutConfig.productX} onChange={e => setLayoutConfig({ ...layoutConfig, productX: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição Y (Vertical)</span> <span>{layoutConfig.productY}%</span></div>
                                                <input type="range" min="0" max="100" step="1" value={layoutConfig.productY} onChange={e => setLayoutConfig({ ...layoutConfig, productY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Ajuste Fino Y (Offset)</span> <span>{layoutConfig.yOffset}px</span></div>
                                                <input type="range" min="-500" max="500" step="1" value={layoutConfig.yOffset} onChange={e => setLayoutConfig({ ...layoutConfig, yOffset: Number(e.target.value) })} />
                                            </div>
                                        </div>
                                    </details>
                                    {/* TV GRADIENT SETTINGS */}
                                    {selectedFormat === 'tv' && (
                                        <details className="control-group" open>
                                            <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Monitor size={16} /> Ajustes TV (Degradê)</div>
                                            </summary>
                                            <div className="details-content" style={{ paddingTop: '12px' }}>
                                                <label className="switch-label">
                                                    <span>Exibir Degradê</span>
                                                    <input type="checkbox" checked={layoutConfig.tvGradientVisible} onChange={e => setLayoutConfig({ ...layoutConfig, tvGradientVisible: e.target.checked })} />
                                                </label>

                                                {layoutConfig.tvGradientVisible && (
                                                    <>
                                                        <div className="color-control" style={{ marginTop: '10px' }}>
                                                            <span>Cor do Degradê</span>
                                                            <input type="color" value={layoutConfig.tvGradientColor} onChange={e => setLayoutConfig({ ...layoutConfig, tvGradientColor: e.target.value })} />
                                                        </div>

                                                        <div style={{ marginTop: '12px' }}>
                                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Direção do Degradê</label>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    className={`btn-secondary ${layoutConfig.tvGradientDirection === 'left' ? 'active' : ''}`}
                                                                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem' }}
                                                                    onClick={() => setLayoutConfig({ ...layoutConfig, tvGradientDirection: 'left' })}
                                                                >
                                                                    Esquerda
                                                                </button>
                                                                <button
                                                                    className={`btn-secondary ${layoutConfig.tvGradientDirection === 'right' ? 'active' : ''}`}
                                                                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem' }}
                                                                    onClick={() => setLayoutConfig({ ...layoutConfig, tvGradientDirection: 'right' })}
                                                                >
                                                                    Direita
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </details>
                                    )}

                                    {/* LOGO POSITIONS */}
                                    <details open className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ImageIcon size={16} /> Logo Empresa</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Logo</span>
                                                <input type="checkbox" checked={layoutConfig.logoVisible} onChange={e => setLayoutConfig({ ...layoutConfig, logoVisible: e.target.checked })} />
                                            </label>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição X</span> <span>{layoutConfig.logoX || 50}%</span></div>
                                                <input type="range" value={layoutConfig.logoX || 50} onChange={e => setLayoutConfig({ ...layoutConfig, logoX: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição Y</span> <span>{layoutConfig.logoY}%</span></div>
                                                <input type="range" value={layoutConfig.logoY} onChange={e => setLayoutConfig({ ...layoutConfig, logoY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Escala</span> <span>{layoutConfig.logoScale}</span></div>
                                                <input type="range" min="0" max="1" step="0.01" value={layoutConfig.logoScale} onChange={e => setLayoutConfig({ ...layoutConfig, logoScale: Number(e.target.value) })} />
                                            </div>

                                            {logoVariations.length > 0 && (
                                                <div style={{ marginTop: '12px' }}>
                                                    <button
                                                        onClick={() => setShowLogoSelector(!showLogoSelector)}
                                                        className="btn-secondary"
                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                    >
                                                        <ImagePlus size={14} />
                                                        Trocar Logotipo
                                                    </button>

                                                    {showLogoSelector && (
                                                        <div className="glass-card" style={{ marginTop: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {logoVariations.map((url, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => handleSelectLogo(url)}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px',
                                                                        padding: '6px',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        background: companyLogoUrl === url ? 'var(--primary-light)' : 'transparent',
                                                                        border: companyLogoUrl === url ? '1px solid var(--primary-color)' : '1px solid transparent'
                                                                    }}
                                                                >
                                                                    <div style={{ width: '40px', height: '40px', background: 'white', border: '1px solid #eee', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                                                                        <img src={url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{idx === 0 ? 'Principal' : `Versão ${idx}`}</span>
                                                                    {companyLogoUrl === url && <Check size={14} color="var(--primary-color)" style={{ marginLeft: 'auto' }} />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </details>

                                    {/* PRICE & SEAL POSITIONS */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Copy size={16} /> Preços e Selos</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Selo</span>
                                                <input type="checkbox" checked={layoutConfig.sealVisible} onChange={e => setLayoutConfig({ ...layoutConfig, sealVisible: e.target.checked })} />
                                            </label>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição X</span> <span>{layoutConfig.sealX}%</span></div>
                                                <input type="range" value={layoutConfig.sealX} onChange={e => setLayoutConfig({ ...layoutConfig, sealX: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Posição Y</span> <span>{layoutConfig.sealY}%</span></div>
                                                <input type="range" value={layoutConfig.sealY} onChange={e => setLayoutConfig({ ...layoutConfig, sealY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Escala Selo</span> <span>{layoutConfig.sealScale}</span></div>
                                                <input type="range" min="0" max="1" step="0.01" value={layoutConfig.sealScale} onChange={e => setLayoutConfig({ ...layoutConfig, sealScale: Number(e.target.value) })} />
                                            </div>

                                            <div style={{ marginTop: '12px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Escolher Selo</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                    {sealOptions.map((url, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setLayoutConfig({ ...layoutConfig, sealUrl: url })}
                                                            style={{
                                                                aspectRatio: '1/1',
                                                                background: 'white',
                                                                border: layoutConfig.sealUrl === url ? '2px solid var(--primary-color)' : '1px solid #eee',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '4px',
                                                                position: 'relative',
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <img src={url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="URL do Selo..."
                                                        style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                                                        value={customSealUrl}
                                                        onChange={(e) => setCustomSealUrl(e.target.value)}
                                                    />
                                                    <button
                                                        className="btn-primary"
                                                        style={{ padding: '0 10px' }}
                                                        onClick={async () => {
                                                            if (customSealUrl) {
                                                                const newSeals = [...sealOptions, customSealUrl];
                                                                setSealOptions(newSeals);
                                                                setLayoutConfig({ ...layoutConfig, sealUrl: customSealUrl });
                                                                setCustomSealUrl('');

                                                                // Save to persistent storage if possible (basic implementation)
                                                                if (userData?.companyId && !isMasterMode) {
                                                                    try {
                                                                        const coRef = doc(db, 'companies', userData.companyId);
                                                                        await updateDoc(coRef, { customSeals: arrayUnion(customSealUrl) });
                                                                    } catch (e) { console.error("Error saving seal", e); }
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="color-control">
                                                <span>Cor do Preço</span>
                                                <input type="color" value={layoutConfig.colorPrice} onChange={e => setLayoutConfig({ ...layoutConfig, colorPrice: e.target.value })} />
                                            </div>

                                            <div style={{ padding: '8px 0', borderTop: '1px solid #eee', marginTop: '8px' }}>
                                                <label className="switch-label">
                                                    <span>Exibir R$</span>
                                                    <input type="checkbox" checked={layoutConfig.currencySymbolVisible} onChange={e => setLayoutConfig({ ...layoutConfig, currencySymbolVisible: e.target.checked })} />
                                                </label>

                                                {layoutConfig.currencySymbolVisible && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Posição do R$</label>
                                                        <select
                                                            value={layoutConfig.currencySymbolPosition || 'before'}
                                                            onChange={e => setLayoutConfig({ ...layoutConfig, currencySymbolPosition: e.target.value })}
                                                            className="form-input"
                                                            style={{ padding: '4px', fontSize: '0.8rem' }}
                                                        >
                                                            <option value="before">Normal (Ao lado)</option>
                                                            <option value="superscript">Sobrescrito (Topo)</option>
                                                            <option value="subscript">Subscrito (Base)</option>
                                                            <option value="top">Em cima (Vertical)</option>
                                                        </select>
                                                    </div>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. X Total</span> <span>{layoutConfig.priceXOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceXOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceXOffset: Number(e.target.value) })} />
                                                    </div>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. Y Total</span> <span>{layoutConfig.priceYOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceYOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceYOffset: Number(e.target.value) })} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. X Real</span> <span>{layoutConfig.priceRealXOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceRealXOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceRealXOffset: Number(e.target.value) })} />
                                                    </div>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. Y Real</span> <span>{layoutConfig.priceRealYOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceRealYOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceRealYOffset: Number(e.target.value) })} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. X Cent.</span> <span>{layoutConfig.priceCentsXOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceCentsXOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceCentsXOffset: Number(e.target.value) })} />
                                                    </div>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. Y Cent.</span> <span>{layoutConfig.priceCentsYOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceCentsYOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceCentsYOffset: Number(e.target.value) })} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. X R$</span> <span>{layoutConfig.priceCurrencyXOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceCurrencyXOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceCurrencyXOffset: Number(e.target.value) })} />
                                                    </div>
                                                    <div className="range-control">
                                                        <div className="range-info"><span>Pos. Y R$</span> <span>{layoutConfig.priceCurrencyYOffset}</span></div>
                                                        <input type="range" min="-50" max="50" step="1" value={layoutConfig.priceCurrencyYOffset || 0} onChange={e => setLayoutConfig({ ...layoutConfig, priceCurrencyYOffset: Number(e.target.value) })} />
                                                    </div>
                                                </div>

                                                <div className="range-control">
                                                    <div className="range-info"><span>Tamanho dos Centavos</span> <span>{layoutConfig.priceCentsScale || 0.6}</span></div>
                                                    <input type="range" min="0" max="1" step="0.05" value={layoutConfig.priceCentsScale || 0.6} onChange={e => setLayoutConfig({ ...layoutConfig, priceCentsScale: Number(e.target.value) })} />
                                                </div>

                                                <div className="range-control">
                                                    <div className="range-info"><span>Tamanho R$</span> <span>{layoutConfig.currencySymbolScale || 0.7}</span></div>
                                                    <input type="range" min="0" max="1.5" step="0.05" value={layoutConfig.currencySymbolScale || 0.7} onChange={e => setLayoutConfig({ ...layoutConfig, currencySymbolScale: Number(e.target.value) })} />
                                                </div>

                                                <div className="range-control">
                                                    <div className="range-info"><span>Tamanho Total</span> <span>{layoutConfig.priceScale || 0.89}</span></div>
                                                    <input type="range" min="0" max="2" step="0.05" value={layoutConfig.priceScale || 0.89} onChange={e => setLayoutConfig({ ...layoutConfig, priceScale: Number(e.target.value) })} />
                                                </div>
                                            </div>
                                        </div>
                                    </details>

                                    {/* DESCRIPTION POSITIONS */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Type size={16} /> Descrição</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Descrição</span>
                                                <input type="checkbox" checked={layoutConfig.descVisible} onChange={e => setLayoutConfig({ ...layoutConfig, descVisible: e.target.checked })} />
                                            </label>

                                            <div className="range-control">
                                                <div className="range-info"><span>Afastamento Base</span> <span>{layoutConfig.descY}%</span></div>
                                                <input type="range" value={layoutConfig.descY} onChange={e => setLayoutConfig({ ...layoutConfig, descY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Tamanho Fonte</span> <span>{layoutConfig.fontSizeDescription}</span></div>
                                                <input type="range" min="0.5" max="4" step="0.1" value={layoutConfig.fontSizeDescription} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeDescription: Number(e.target.value) })} />
                                            </div>

                                            <div className="color-control">
                                                <span>Cor da Descrição</span>
                                                <input type="color" value={layoutConfig.colorDescription} onChange={e => setLayoutConfig({ ...layoutConfig, colorDescription: e.target.value })} />
                                            </div>
                                        </div>
                                    </details>

                                    {/* CODES POSITIONS */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Códigos (EAN/Interno)</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Cód. Interno</span>
                                                <input type="checkbox" checked={layoutConfig.showInternalCode} onChange={e => setLayoutConfig({ ...layoutConfig, showInternalCode: e.target.checked })} />
                                            </label>
                                            <div className="range-control">
                                                <div className="range-info"><span>Posição X</span> <span>{layoutConfig.codeInternalX}%</span></div>
                                                <input type="range" value={layoutConfig.codeInternalX} onChange={e => setLayoutConfig({ ...layoutConfig, codeInternalX: Number(e.target.value) })} />
                                            </div>
                                            <div className="range-control">
                                                <div className="range-info"><span>Posição Y</span> <span>{layoutConfig.codeInternalY}%</span></div>
                                                <input type="range" value={layoutConfig.codeInternalY} onChange={e => setLayoutConfig({ ...layoutConfig, codeInternalY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Tamanho Fonte</span> <span>{layoutConfig.fontSizeInternalCode || 1.4}</span></div>
                                                <input type="range" min="0.5" max="3" step="0.1" value={layoutConfig.fontSizeInternalCode || 1.4} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeInternalCode: Number(e.target.value) })} />
                                            </div>

                                            <div className="color-control">
                                                <span>Cor do Texto</span>
                                                <input type="color" value={layoutConfig.colorInternalCode || '#ffffff'} onChange={e => setLayoutConfig({ ...layoutConfig, colorInternalCode: e.target.value })} />
                                            </div>

                                            <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />

                                            <label className="switch-label">
                                                <span>Exibir EAN</span>
                                                <input type="checkbox" checked={layoutConfig.showEan} onChange={e => setLayoutConfig({ ...layoutConfig, showEan: e.target.checked })} />
                                            </label>
                                            <div className="range-control">
                                                <div className="range-info"><span>Posição X</span> <span>{layoutConfig.codeEanX}%</span></div>
                                                <input type="range" value={layoutConfig.codeEanX} onChange={e => setLayoutConfig({ ...layoutConfig, codeEanX: Number(e.target.value) })} />
                                            </div>
                                            <div className="range-control">
                                                <div className="range-info"><span>Posição Y</span> <span>{layoutConfig.codeEanY}%</span></div>
                                                <input type="range" value={layoutConfig.codeEanY} onChange={e => setLayoutConfig({ ...layoutConfig, codeEanY: Number(e.target.value) })} />
                                            </div>

                                            <div className="range-control">
                                                <div className="range-info"><span>Tamanho Fonte</span> <span>{layoutConfig.fontSizeEan || 1.4}</span></div>
                                                <input type="range" min="0.5" max="3" step="0.1" value={layoutConfig.fontSizeEan || 1.4} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeEan: Number(e.target.value) })} />
                                            </div>

                                            <div className="color-control">
                                                <span>Cor do EAN</span>
                                                <input type="color" value={layoutConfig.colorEan || '#ffffff'} onChange={e => setLayoutConfig({ ...layoutConfig, colorEan: e.target.value })} />
                                            </div>

                                            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                                <label className="switch-label">
                                                    <span>Sombra</span>
                                                    <input type="checkbox" checked={layoutConfig.codeShadow} onChange={e => setLayoutConfig({ ...layoutConfig, codeShadow: e.target.checked })} />
                                                </label>
                                                <label className="switch-label">
                                                    <span>Contorno</span>
                                                    <input type="checkbox" checked={layoutConfig.codeStroke} onChange={e => setLayoutConfig({ ...layoutConfig, codeStroke: e.target.checked })} />
                                                </label>
                                            </div>
                                        </div>
                                    </details>

                                    {/* TEXTO ADICIONAL / OVERLAY (LEGACY HTML STYLE) */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Type size={16} /> Texto Adicional (Rodapé)</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Texto</span>
                                                <input type="checkbox" checked={layoutConfig.customTextVisible} onChange={e => setLayoutConfig({ ...layoutConfig, customTextVisible: e.target.checked })} />
                                            </label>

                                            <div className="input-group" style={{ marginBottom: '12px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Conteúdo do Texto</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    style={{ height: '36px', fontSize: '0.8rem' }}
                                                    value={layoutConfig.customText}
                                                    onChange={e => setLayoutConfig({ ...layoutConfig, customText: e.target.value })}
                                                />
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div className="range-control">
                                                    <div className="range-info"><span>Tamanho</span> <span>{layoutConfig.customTextSize}</span></div>
                                                    <input type="range" min="8" max="40" value={layoutConfig.customTextSize} onChange={e => setLayoutConfig({ ...layoutConfig, customTextSize: Number(e.target.value) })} />
                                                </div>
                                                <div className="range-control">
                                                    <div className="range-info"><span>Cor</span></div>
                                                    <input type="color" value={layoutConfig.customTextColor} style={{ height: '30px', padding: 2, border: 'none', background: 'transparent' }} onChange={e => setLayoutConfig({ ...layoutConfig, customTextColor: e.target.value })} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                                <div className="range-control">
                                                    <div className="range-info"><span>Posição X</span> <span>{layoutConfig.customTextX}%</span></div>
                                                    <input type="range" min="0" max="100" value={layoutConfig.customTextX} onChange={e => setLayoutConfig({ ...layoutConfig, customTextX: Number(e.target.value) })} />
                                                </div>
                                                <div className="range-control">
                                                    <div className="range-info"><span>Posição Y</span> <span>{layoutConfig.customTextY}%</span></div>
                                                    <input type="range" min="0" max="100" value={layoutConfig.customTextY} onChange={e => setLayoutConfig({ ...layoutConfig, customTextY: Number(e.target.value) })} />
                                                </div>
                                            </div>

                                            <div className="range-control" style={{ marginTop: '10px' }}>
                                                <div className="range-info"><span>Rotação</span> <span>{layoutConfig.customTextRotation}°</span></div>
                                                <input type="range" min="-180" max="180" value={layoutConfig.customTextRotation} onChange={e => setLayoutConfig({ ...layoutConfig, customTextRotation: Number(e.target.value) })} />
                                            </div>
                                        </div>
                                    </details>

                                    {/* MARCA D'ÁGUA / WATERMARK */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} /> Identificação e Segurança</div>
                                        </summary>
                                        <div className="details-content" style={{ paddingTop: '12px' }}>
                                            <label className="switch-label">
                                                <span>Exibir Identificação</span>
                                                <input type="checkbox" checked={layoutConfig.watermarkVisible} onChange={e => setLayoutConfig({ ...layoutConfig, watermarkVisible: e.target.checked })} />
                                            </label>
                                            <div className="range-control">
                                                <div className="range-info"><span>Opacidade</span> <span>{Math.round(layoutConfig.watermarkOpacity * 100)}%</span></div>
                                                <input type="range" min="0" max="1" step="0.05" value={layoutConfig.watermarkOpacity} onChange={e => setLayoutConfig({ ...layoutConfig, watermarkOpacity: Number(e.target.value) })} />
                                            </div>
                                        </div>
                                    </details>

                                    {/* LAYERS REORDERING */}
                                    <details className="control-group">
                                        <summary style={{ fontWeight: 700, fontSize: '0.85rem', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #efefef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Ordem das Camadas</div>
                                        </summary>
                                        <div className="details-content" style={{ padding: '12px 0' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                                Arraste para cima para trazer o elemento para frente (Photoshop style).
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {[...(layoutConfig.layersOrder || [])].reverse().map((layer, idx, arr) => (
                                                    <div
                                                        key={layer}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '10px',
                                                            background: 'white',
                                                            borderRadius: '8px',
                                                            border: '1px solid #e2e8f0',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                        }}
                                                    >
                                                        <div style={{ color: 'var(--primary-color)', fontWeight: 800, fontSize: '0.8rem', width: '20px' }}>#{arr.length - idx}</div>
                                                        <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                                            {layer === 'seal' ? 'Selo de Preço' :
                                                                layer === 'logo' ? 'Logo da Empresa' :
                                                                    layer === 'description' ? 'Nome do Produto' : 'Códigos/EAN'}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                disabled={idx === 0}
                                                                onClick={() => {
                                                                    const newOrder = [...layoutConfig.layersOrder];
                                                                    const actualIdx = newOrder.indexOf(layer);
                                                                    // In reversed list, moving UP means moving FORWARD in original array
                                                                    const temp = newOrder[actualIdx];
                                                                    newOrder[actualIdx] = newOrder[actualIdx + 1];
                                                                    newOrder[actualIdx + 1] = temp;
                                                                    setLayoutConfig({ ...layoutConfig, layersOrder: newOrder });
                                                                }}
                                                                style={{ padding: '4px', background: idx === 0 ? '#f1f5f9' : '#e0e7ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
                                                            </button>
                                                            <button
                                                                disabled={idx === arr.length - 1}
                                                                onClick={() => {
                                                                    const newOrder = [...layoutConfig.layersOrder];
                                                                    const actualIdx = newOrder.indexOf(layer);
                                                                    const temp = newOrder[actualIdx];
                                                                    newOrder[actualIdx] = newOrder[actualIdx - 1];
                                                                    newOrder[actualIdx - 1] = temp;
                                                                    setLayoutConfig({ ...layoutConfig, layersOrder: newOrder });
                                                                }}
                                                                style={{ padding: '4px', background: idx === arr.length - 1 ? '#f1f5f9' : '#e0e7ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                <ChevronDown size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </details>

                                    <button className="btn btn-primary" onClick={handleSaveLayout} style={{
                                        marginTop: '1.5rem',
                                        width: '100%',
                                        height: '48px',
                                        borderRadius: '12px',
                                        fontSize: '1rem',
                                        background: isMasterMode ? 'var(--primary-color)' : '#3b82f6',
                                        border: 'none',
                                        boxShadow: isMasterMode ? '0 4px 15px rgba(0, 114, 255, 0.4)' : 'none'
                                    }}>
                                        <Save size={20} style={{ marginRight: 10 }} />
                                        {isMasterMode ? `Salvar Baseline GLOBAL (${selectedFormat.toUpperCase()})` : 'Salvar Layout'}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>      {/* CENTER GRID AREA */}
                <div className="module-main" style={{ display: 'block', padding: '2rem', overflowY: 'auto' }}>
                    {products.length > 0 ? (
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            {/* Status Banner */}
                            {foundCount > 0 && (
                                <div style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '12px',
                                    padding: '1rem 2rem',
                                    textAlign: 'center',
                                    marginBottom: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    color: '#166534',
                                    fontWeight: 600,
                                    fontSize: '1.1rem'
                                }}>
                                    <span>✨</span> Parabéns! Encontramos <strong>{foundCount}</strong> lâminas prontas!
                                </div>
                            )}

                            {foundCount === 0 && !processing && (
                                <div style={{
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    marginBottom: '2rem',
                                    color: '#9f1239',
                                    animation: 'fadeIn 0.5s'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Nenhum produto identificado</h3>
                                    <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                                        Não foi possível encontrar nenhuma lâmina para o texto informado.<br />
                                        Certifique-se de que cada linha contém um <strong>Código</strong> ou <strong>Preço</strong>.
                                    </p>
                                </div>
                            )}

                            {foundCount > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleExportAll}
                                    disabled={processing}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        padding: '1rem 2rem',
                                        fontSize: '1.2rem',
                                        fontWeight: 700,
                                        background: '#22c55e',
                                        borderColor: '#22c55e',
                                        margin: '0 auto 3rem auto',
                                        width: 'auto',
                                        minWidth: '300px',
                                        borderRadius: '12px'
                                    }}
                                >
                                    {processing ? <Loader2 className="loading-spinner" /> : <DownloadCloud size={24} />}
                                    <span style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {processing ? (statusMessage || 'Processando...') : `Baixar ${foundCount} imagens prontas`}
                                    </span>
                                </button>
                            )}

                            {/* Grid of Miniatures */}
                            <div className="laminas-grid">
                                {products.map((p, i) => ({ p, i }))
                                    .filter(item => item.p.isLinked)
                                    .map(({ p, i }) => (
                                        <div key={p.id || i} className="lamina-grid-item fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                            {renderLaminaPreview(p, i, true)}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <FileText size={60} style={{ opacity: 0.1 }} />
                            <h3>Processar itens para ver as miniaturas</h3>
                        </div>
                    )}
                </div>
            </div >

            <style>{`
                .module-container { display: flex; flexDirection: column; gap: 1rem; height: calc(100vh - 120px); }
                .module-layout { display: flex; gap: 1.5rem; flex: 1; overflow: hidden; }
                .module-sidebar { width: 340px; flexShrink: 0; display: flex; flexDirection: column; gap: 1rem; overflowY: auto; }
                .module-main { flex: 1; background: transparent; position: relative; overflow: auto; padding: 2rem; }
                
                .search-result-item:hover { background: #f1f5f9; }
                .delete-item-btn:hover { color: var(--error-color); opacity: 1 !important; }
                
                .aspect-ratio-box.thumbnail { 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    border-radius: 16px; 
                    overflow: hidden; 
                    background: white;
                    border: 0; /* Cleaner look */
                }
                .aspect-ratio-box.thumbnail:hover { 
                    transform: translateY(-4px); 
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
                }
                
                .laminas-grid { 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 1.5rem; 
                }
                .lamina-grid-item { position: relative; }
                
                .control-group { background: white; border-radius: 8px; padding: 0 12px; border: 1px solid #e2e8f0; margin-bottom: 8px; }
                .control-group details > summary { outline: none; transition: color 0.2s; }
                .control-group details > summary:hover { color: var(--primary-color); }

                .switch-label { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 12px; }
                .range-control { margin-bottom: 12px; }
                .range-info { display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-bottom: 4px; }
                .range-control input { width: 100%; height: 6px; border-radius: 10px; appearance: none; background: #e2e8f0; }
                .range-control input::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; cursor: pointer; }
                .color-control { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 12px; }
                .color-control input { width: 40px; height: 30px; border: none; border-radius: 6px; cursor: pointer; }

                .slide-content { position: relative; width: 100%; height: 100%; }
                .placeholder-slide { width: 100%; height: 100%; display: flex; flexDirection: column; alignItems: center; justifyContent: center; color: #cbd5e1; }
                .overlay-layer { position: absolute; inset: 0; pointerEvents: none; zIndex: 10; }
                
                @media (max-width: 991px) {
                    .module-layout { flexDirection: column; }
                    .module-sidebar { width: 100%; flexShrink: initial; }
                    .module-main { minHeight: 400px; padding: 1rem; }
                }
            `}</style>
        </div >
    );
};

export default LaminasModule;
