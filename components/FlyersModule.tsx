import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, setDoc, writeBatch, arrayUnion, limit, orderBy, serverTimestamp } from 'firebase/firestore';
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
    Check,
    Smartphone,
    Send,
    Upload,
    Info,
    RefreshCw,
    X,
    MoreVertical,
    Share2,
    Trash2,
    Globe,
    Calendar,
    Filter
} from 'lucide-react';
import { uploadToR2 } from '../services/r2Service';
import { Theme, ProductItem, LayoutConfig, GridFormatKey, GRID_FORMATS } from './FlyerTypes';
import { FlyerPage } from './FlyerPage';
import { SmartImage } from './SmartImage';
import { FlyerExportOrchestrator, FlyerExportOrchestratorRef } from './FlyerExportOrchestrator';
import { DEFAULT_LAYOUT_CONFIG } from '../constants';
import { GRID_CONFIG_DEFAULTS } from './GridDefaults';
import { sendAdminNotification, AdminNotificationType } from '../services/NotificationService';

const deepMerge = (target: any, source: any) => {
    const output = { ...target };
    if (source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

// Export libraries
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { sanitizeAndNormalize } from '../utils/productUtils';



interface FlyersModuleProps {
    isMasterMode?: boolean;
    initialAvailability?: 'encartes' | 'catalogo';
}

const FlyersModule: React.FC<FlyersModuleProps> = ({ isMasterMode = false, initialAvailability = 'encartes' }) => {
    const { userData, refreshUserData } = useAuth();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'products' | 'theme' | 'layout'>('products');
    const [availabilityFilter, setAvailabilityFilter] = useState<'encartes' | 'catalogo'>(initialAvailability);

    // Inputs
    const [inputText, setInputText] = useState('');
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [globalResults, setGlobalResults] = useState<any[]>([]);
    const [searchingGlobal, setSearchingGlobal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Theme
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
    const [loadingThemes, setLoadingThemes] = useState(false);
    const [themeSearch, setThemeSearch] = useState('');

    // Grid Format Configuration Mode (for draft themes)
    const [selectedGridFormat, setSelectedGridFormat] = useState<GridFormatKey | null>(null);
    const [isConfiguringFormat, setIsConfiguringFormat] = useState(false);
    const [bulkApplyFormats, setBulkApplyFormats] = useState<GridFormatKey[]>([]);

    // Theme Update Detection
    const [themeHasUpdates, setThemeHasUpdates] = useState(false);
    const [companyLastSync, setCompanyLastSync] = useState<Date | null>(null);

    // Layout Config
    const [layoutConfig, setLayoutConfig] = useState(DEFAULT_LAYOUT_CONFIG);

    const productsProcessedRef = useRef(false);
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
    const [currentPreviewPage, setCurrentPreviewPage] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(0.5);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
    const [logoVariations, setLogoVariations] = useState<string[]>([]);
    const [showLogoSelector, setShowLogoSelector] = useState(false);
    const [showOnlyWithPhoto, setShowOnlyWithPhoto] = useState(true);

    // Phone Request Modal
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [tempPhone, setTempPhone] = useState('');
    const [pendingWhatsappSend, setPendingWhatsappSend] = useState<number | null>(null);

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

    // ========== ENCARTE CONTINUITY FEATURE ==========
    const ENCARTE_STORAGE_KEY = `encarte_draft_${userData?.companyId || 'default'}`;

    // Save encarte state automatically
    const saveEncarteDraft = () => {
        if (!products.length && !selectedTheme) return;
        const draft = {
            products: products.map(p => ({
                id: p.id,
                description: p.description,
                price: p.price,
                ean: p.ean,
                internalCode: p.internalCode,
                category: p.category,
                packaging: p.packaging,
                imageUrl: p.imageUrl,
                candidateUrls: p.candidateUrls,
                isLinked: p.isLinked,
                sizeMultiplier: p.sizeMultiplier,
                rawText: p.rawText
            })),
            selectedThemeId: selectedTheme?.id || null,
            layoutConfig: layoutConfig,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(ENCARTE_STORAGE_KEY, JSON.stringify(draft));
    };

    // Load saved encarte draft
    const loadEncarteDraft = () => {
        try {
            const saved = localStorage.getItem(ENCARTE_STORAGE_KEY);
            if (!saved) return null;
            return JSON.parse(saved);
        } catch {
            return null;
        }
    };

    // Clear encarte draft
    const clearEncarteDraft = () => {
        localStorage.removeItem(ENCARTE_STORAGE_KEY);
    };

    // Auto-save effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            saveEncarteDraft();
        }, 2000); // Auto-save after 2 seconds of inactivity
        return () => clearTimeout(timeoutId);
    }, [products, selectedTheme, layoutConfig]);

    // State for restoration prompt
    const [showRestorePrompt, setShowRestorePrompt] = useState(false);
    const [savedDraft, setSavedDraft] = useState<any>(null);

    // Check for saved draft on mount
    useEffect(() => {
        const draft = loadEncarteDraft();
        if (draft && draft.products?.length > 0) {
            // Only show prompt if there's meaningful data saved
            setSavedDraft(draft);
            setShowRestorePrompt(true);
        }
    }, []);

    // Restore draft function
    const handleRestoreDraft = async () => {
        if (!savedDraft) return;

        // Restore products
        setProducts(savedDraft.products.map((p: any) => ({
            ...p,
            loadingFirestore: false
        })));

        // Restore layout
        if (savedDraft.layoutConfig) {
            setLayoutConfig(deepMerge(DEFAULT_LAYOUT_CONFIG, savedDraft.layoutConfig));
        }

        // Restore theme if available
        if (savedDraft.selectedThemeId && themes.length > 0) {
            const found = themes.find(t => t.id === savedDraft.selectedThemeId);
            if (found) setSelectedTheme(found);
        }

        setShowRestorePrompt(false);
    };

    const handleDiscardDraft = () => {
        clearEncarteDraft();
        setShowRestorePrompt(false);
        setSavedDraft(null);
    };
    // ========== END ENCARTE CONTINUITY FEATURE ==========


    const checkImageExists = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    };

    useEffect(() => {
        const init = async () => {
            if (userData?.companyId || isMasterMode) {
                const fetchedThemes = await fetchThemes();
                const themeId = searchParams.get('themeId');
                const gridFormat = searchParams.get('gridFormat') as GridFormatKey | null;

                if (themeId && fetchedThemes) {
                    const found = fetchedThemes.find(t => t.id === themeId);
                    if (found) {
                        setSelectedTheme(found);

                        // Check if we're configuring a specific grid format
                        if (gridFormat && GRID_FORMATS.some(g => g.key === gridFormat)) {
                            setSelectedGridFormat(gridFormat);
                            setIsConfiguringFormat(true);

                            // Load existing config for this format if available
                            const existingConfig = found.gridConfigs?.[gridFormat]?.layoutConfig;
                            if (existingConfig) {
                                setLayoutConfig(deepMerge(DEFAULT_LAYOUT_CONFIG, existingConfig));
                            } else if (found.defaultLayoutConfig) {
                                // Fallback to default layout config
                                setLayoutConfig(deepMerge(DEFAULT_LAYOUT_CONFIG, found.defaultLayoutConfig));
                            }

                            // Set the grid columns/rows for this format
                            const format = GRID_FORMATS.find(g => g.key === gridFormat);
                            if (format) {
                                setLayoutConfig(prev => ({
                                    ...prev,
                                    columns: format.columns,
                                    rows: format.rows
                                }));
                            }
                        } else if (found.defaultLayoutConfig) {
                            setLayoutConfig(deepMerge(DEFAULT_LAYOUT_CONFIG, found.defaultLayoutConfig));
                        }

                        setActiveTab('layout'); // Jump to layout tab if we coming from settings
                    }
                }
                fetchCompanyLogo();
            }
        };
        init();
    }, [userData, searchParams]);

    useEffect(() => {
        if (userData?.companyId || isMasterMode) {
            fetchThemes();
        }
    }, [availabilityFilter, userData?.companyId]);
    useEffect(() => {
        setAvailabilityFilter(initialAvailability);
    }, [initialAvailability]);

    const fetchCompanyLogo = async () => {
        const companyId = userData?.companyId || searchParams.get('companyId');
        if (!companyId) return;
        try {
            const docRef = doc(db, 'companies', companyId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const mainLogo = data.logoUrl || null;
                const variations = data.logoVariations || [];
                const variationsList = [mainLogo, ...variations].filter(Boolean) as string[];
                setLogoVariations(variationsList);

                // Preference per theme
                if (selectedTheme?.id) {
                    const themePref = data.themeLogoPreferences?.[selectedTheme.id];
                    if (themePref && variationsList.includes(themePref)) {
                        setCompanyLogoUrl(themePref);
                    } else {
                        setCompanyLogoUrl(mainLogo);
                    }
                } else if (!companyLogoUrl) {
                    setCompanyLogoUrl(mainLogo);
                }
            }
        } catch (e) {
            console.error("Error fetching company logo", e);
        }
    };

    const handleSelectLogo = async (url: string) => {
        setCompanyLogoUrl(url);
        setShowLogoSelector(false);

        const companyId = userData?.companyId || searchParams.get('companyId');
        if (companyId && selectedTheme?.id) {
            try {
                const docRef = doc(db, 'companies', companyId);
                await updateDoc(docRef, {
                    [`themeLogoPreferences.${selectedTheme.id}`]: url
                });
            } catch (e) {
                console.error("Error saving logo preference:", e);
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
            const term = val.trim();
            const isEan = /^\d+$/.test(term) && term.length >= 8;
            const productsRef = collection(db, 'products');
            let results: any[] = [];

            if (isEan) {
                // Exact EAN search
                const q = query(productsRef, where('ean', '==', term), limit(5));
                const snap = await getDocs(q);
                results = snap.docs.map(doc => doc.data());
            } else {
                // Name prefix search (case-sensitive as per Firestore)
                // We try the original term and a capitalized version for better coverage
                const q1 = query(productsRef,
                    where('name', '>=', term),
                    where('name', '<=', term + '\uf8ff'),
                    limit(10)
                );
                const snap1 = await getDocs(q1);
                results = snap1.docs.map(doc => doc.data());

                if (results.length < 10) {
                    const capitalized = term.charAt(0).toUpperCase() + term.slice(1);
                    if (capitalized !== term) {
                        const q2 = query(productsRef,
                            where('name', '>=', capitalized),
                            where('name', '<=', capitalized + '\uf8ff'),
                            limit(10)
                        );
                        const snap2 = await getDocs(q2);
                        const res2 = snap2.docs.map(doc => doc.data());

                        // Merge results
                        const existingEans = new Set(results.map(r => r.ean));
                        res2.forEach(r => {
                            if (!existingEans.has(r.ean)) {
                                results.push(r);
                            }
                        });
                    }
                }
            }

            setGlobalResults(results.slice(0, 10));
        } catch (error) {
            console.error("Error searching global products:", error);
        } finally {
            setSearchingGlobal(false);
        }
    };

    const addProductToList = (p: any) => {
        const textToAdd = `${p.ean || ''} ${p.name || ''}\n`;
        setInputText(prev => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + textToAdd);
        setGlobalSearch('');
        setGlobalResults([]);
    };

    const fetchThemes = async () => {
        setLoadingThemes(true);
        try {
            const themesRef = collection(db, 'themes');
            const q = query(themesRef, orderBy('name'));
            const snapshot = await getDocs(q);
            const themesList = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Theme));

            const finalFiltered = themesList.filter(theme => {
                // 1. Accessibility Check
                const isPublic = theme.isPublic === true;
                const isOwner = theme.companyId === userData?.companyId;
                const isAllowed = theme.allowedCompanies?.includes(userData?.companyId);
                const isActive = theme.isActive !== false;

                if (!isActive && !isMasterMode) return false;
                if (!(isMasterMode || isOwner || isPublic || isAllowed)) return false;

                // 2. Configuration & Relevance (Softer)
                const isConfigured = theme.isConfigured !== false;
                if (!isMasterMode && !isOwner && !isConfigured) return false;

                // 3. Availability Filter
                const availability = Array.isArray(theme.availability) ? theme.availability : [];
                if (availability.length === 0) {
                    return availabilityFilter === 'encartes';
                }
                return availability.includes(availabilityFilter);
            });

            // 4. Sort by Month Priority
            const currentMonth = new Date().getMonth() + 1; // 1-12
            finalFiltered.sort((a, b) => {
                const monthA = a.month || 0;
                const monthB = b.month || 0;

                // Priority 1: Current Month
                if (monthA === currentMonth && monthB !== currentMonth) return -1;
                if (monthB === currentMonth && monthA !== currentMonth) return 1;

                // Priority 2: Any month set (non-zero) comes before general (zero)
                if (monthA !== 0 && monthB === 0) return -1;
                if (monthA === 0 && monthB !== 0) return 1;

                // Priority 3: Upcoming months (if current is 3, then 4, 5... are better than 1, 2)
                if (monthA !== 0 && monthB !== 0) {
                    const adjA = monthA >= currentMonth ? monthA : monthA + 12;
                    const adjB = monthB >= currentMonth ? monthB : monthB + 12;
                    if (adjA !== adjB) return adjA - adjB;
                }

                // Priority 4: Name alphabetical
                return a.name.localeCompare(b.name);
            });

            setThemes(finalFiltered);

            // Sync selection
            if (finalFiltered.length > 0) {
                if (!selectedTheme || !finalFiltered.find(t => t.id === selectedTheme.id)) {
                    setSelectedTheme(finalFiltered[0]);
                }
            } else {
                setSelectedTheme(null);
            }

            return finalFiltered;
        } catch (error) {
            console.error("Error fetching themes:", error);
            return [];
        } finally {
            setLoadingThemes(false);
        }
    };

    useEffect(() => {
        if (selectedTheme && (userData?.companyId || isMasterMode)) {
            loadCustomThemeSettings();
        }
    }, [selectedTheme?.id, userData?.companyId, isMasterMode]);

    const loadCustomThemeSettings = async (targetFormatKey?: GridFormatKey) => {
        if (!selectedTheme) return;
        if (!isMasterMode && !userData?.companyId) return;

        try {
            // 1. Fetch the FRESH theme document to get the latest baseline
            const themeRef = doc(db, 'themes', selectedTheme.id);
            const themeSnap = await getDoc(themeRef);
            const freshThemeData = themeSnap.exists() ? themeSnap.data() : selectedTheme;

            // Get global theme update time
            const themeUpdatedAt = freshThemeData.updatedAt?.toDate?.() || freshThemeData.updatedAt || new Date(0);

            // Determinar qual formato estamos buscando (parâmetro ou atual)
            const currentFormat = GRID_FORMATS.find(f => f.columns === layoutConfig.columns && f.rows === layoutConfig.rows);
            const formatKey = targetFormatKey || (currentFormat?.key as GridFormatKey);

            // 2. Always start with the system-wide defaults
            let finalConfig = { ...DEFAULT_LAYOUT_CONFIG };

            // Apply format-specific defaults if they exist
            if (formatKey && GRID_CONFIG_DEFAULTS[formatKey]) {
                finalConfig = deepMerge(finalConfig, GRID_CONFIG_DEFAULTS[formatKey]);
            }

            // 3. Apply global theme baseline (what Super Admin set)
            if (freshThemeData.defaultLayoutConfig) {
                finalConfig = deepMerge(finalConfig, freshThemeData.defaultLayoutConfig);
            }

            // 4. Se houver um formato específico definido no TEMA, aplica ele sobre o baseline
            if (formatKey && freshThemeData.gridConfigs?.[formatKey]?.layoutConfig) {
                finalConfig = deepMerge(finalConfig, freshThemeData.gridConfigs[formatKey].layoutConfig);
            }

            // 5. Apply company-specific overrides (if any)
            if (!isMasterMode && userData?.companyId) {
                const settingsId = `${userData.companyId}_${selectedTheme.id}`;
                const settingsRef = doc(db, 'company_theme_settings', settingsId);
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    const companySettingsData = settingsDoc.data();
                    const companyUpdatedAt = companySettingsData.updatedAt?.toDate?.() || companySettingsData.updatedAt || new Date(0);

                    // Check if global theme is newer than company settings (logic for warning)
                    if (themeUpdatedAt > companyUpdatedAt) {
                        setThemeHasUpdates(true);
                    } else {
                        setThemeHasUpdates(false);
                    }
                    setCompanyLastSync(companyUpdatedAt);

                    // Busca o override específico do formato, ou o legado global se não existir
                    const formatOverride = formatKey ? companySettingsData.gridConfigs?.[formatKey]?.layoutConfig : null;
                    const legacyOverride = companySettingsData.layoutConfig;

                    const customConfig = formatOverride || legacyOverride;

                    if (customConfig) {
                        finalConfig = deepMerge(finalConfig, customConfig);
                    }
                } else {
                    // No custom settings yet
                    setThemeHasUpdates(false);
                    setCompanyLastSync(null);

                    if (freshThemeData.defaultPromoMonth) {
                        finalConfig.promoMonth = {
                            ...(finalConfig.promoMonth || DEFAULT_LAYOUT_CONFIG.promoMonth),
                            text: freshThemeData.defaultPromoMonth,
                            visible: true
                        };
                    }
                }
            }

            // Forçar as colunas/linhas se viermos de um switch
            if (targetFormatKey) {
                const targetPreset = GRID_FORMATS.find(f => f.key === targetFormatKey);
                if (targetPreset) {
                    finalConfig.columns = targetPreset.columns;
                    finalConfig.rows = targetPreset.rows;
                }
            }

            setLayoutConfig(finalConfig);

            // Sync selectedTheme local state if Firestore is newer
            if (themeSnap.exists()) {
                const refreshedTheme = { id: themeSnap.id, ...freshThemeData } as Theme;
                if (JSON.stringify(refreshedTheme.gridConfigs) !== JSON.stringify(selectedTheme.gridConfigs)) {
                    setSelectedTheme(refreshedTheme);
                }
            }

        } catch (err) {
            console.error("Erro ao carregar ajustes:", err);
            setLayoutConfig({ ...DEFAULT_LAYOUT_CONFIG, ...(selectedTheme.defaultLayoutConfig || {}) });
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

    const handleUploadImageForProduct = async (product: ProductItem, file: File) => {
        if (!userData?.companyId || !product.ean) {
            if (!product.ean) alert("Este item não possui código EAN. Não é possível vincular uma imagem persistente.");
            return;
        }

        try {
            const url = await uploadToR2(file, `private_products/${userData.companyId}`);

            const productId = `${userData.companyId}_${product.ean}`;
            const productData = {
                ean: product.ean,
                name: product.description,
                imageUrl: url,
                isGlobal: false,
                companyId: userData.companyId,
                status: 'approved',
                updatedAt: new Date(),
                uploadedBy: userData.uid,
                uploadedByName: userData.name || userData.displayName
            };

            await setDoc(doc(db, 'products', productId), productData, { merge: true });

            // Update local state
            setProducts(prev => prev.map(p =>
                p.id === product.id ? { ...p, imageUrl: url, isLinked: true } : p
            ));

            // Also resolve any pending request
            updateDoc(doc(db, 'product_requests', product.ean), {
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedBy: userData.uid
            }).catch(() => { });

            // Notify Admin
            sendAdminNotification(
                "Nova Imagem (Upload Individual)",
                `A empresa ${userData.memberships?.find(m => m.companyId === userData.companyId)?.companyName || 'N/A'} fez upload de uma imagem customizada para o produto: ${product.description} (EAN: ${product.ean})`,
                AdminNotificationType.INFO,
                "/admin/banco-imagens",
                "BANCO DE IMAGENS"
            );

        } catch (error) {
            console.error("Error uploading image for product:", error);
            alert("Erro ao fazer upload da imagem.");
        }
    };

    const handleSaveThemeConfig = async () => {
        if (!selectedTheme) return;

        setIsSaving(true);
        try {
            // Check if we're configuring a specific grid format for a draft theme
            if (isConfiguringFormat && selectedGridFormat && isMasterMode) {
                const themeRef = doc(db, 'themes', selectedTheme.id);

                // Update gridConfigs for this specific format
                const currentGridConfigs = selectedTheme.gridConfigs || {};
                const updatedGridConfigs = {
                    ...currentGridConfigs,
                    [selectedGridFormat]: {
                        layoutConfig: layoutConfig,
                        isConfigured: true
                    }
                };

                // Calculate configured formats list
                const configuredFormats = GRID_FORMATS
                    .filter(f => updatedGridConfigs[f.key]?.isConfigured)
                    .map(f => f.key);

                const allConfigured = configuredFormats.length === GRID_FORMATS.length;

                await updateDoc(themeRef, {
                    gridConfigs: updatedGridConfigs,
                    configuredFormats: configuredFormats,
                    isConfigured: allConfigured,
                    updatedAt: new Date()
                });

                // SYNC LOCAL STATE
                const updatedTheme = {
                    ...selectedTheme,
                    gridConfigs: updatedGridConfigs,
                    configuredFormats: configuredFormats,
                    isConfigured: allConfigured
                };
                setSelectedTheme(updatedTheme);
                setThemes(prev => prev.map(t => t.id === selectedTheme.id ? updatedTheme : t));

                const formatLabel = GRID_FORMATS.find(f => f.key === selectedGridFormat)?.label || selectedGridFormat;
                alert(`Configuração do formato ${formatLabel} salva com sucesso!\n\nFormatos configurados: ${configuredFormats.length}/5${allConfigured ? '\n\n✅ Tema pronto para publicação!' : ''}`);

            } else if (isMasterMode) {
                // MASTER MODE (legacy): Save to the theme baseline itself
                const themeRef = doc(db, 'themes', selectedTheme.id);
                await updateDoc(themeRef, {
                    defaultLayoutConfig: layoutConfig,
                    isConfigured: true,
                    updatedAt: new Date()
                });

                // SYNC LOCAL STATE
                const updatedTheme = { ...selectedTheme, defaultLayoutConfig: layoutConfig, isConfigured: true };
                setSelectedTheme(updatedTheme);
                setThemes(prev => prev.map(t => t.id === selectedTheme.id ? updatedTheme : t));

                alert("Baseline GLOBAL do tema salvo com sucesso! O tema agora está ativo para todos.");
            } else if (userData?.companyId) {
                // USER MODE: Save as company-specific override per format
                const settingsId = `${userData.companyId}_${selectedTheme.id}`;
                const settingsRef = doc(db, 'company_theme_settings', settingsId);

                // Identificar qual o formato atual baseado nas colunas/linhas
                const currentFormat = GRID_FORMATS.find(f => f.columns === layoutConfig.columns && f.rows === layoutConfig.rows);
                const formatKey = currentFormat?.key || `${layoutConfig.columns}x${layoutConfig.rows}`;

                const updateData: any = {
                    companyId: userData.companyId,
                    themeId: selectedTheme.id,
                    updatedAt: new Date()
                };

                // Salvar na estrutura de gridConfigs para manter compatibilidade e independência
                updateData[`gridConfigs.${formatKey}`] = {
                    layoutConfig: layoutConfig,
                    isConfigured: true
                };

                await setDoc(settingsRef, updateData, { merge: true });

                alert(`Ajustes salvos com sucesso para o formato ${currentFormat?.label || formatKey}!`);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar configurações.");
        } finally {
            setIsSaving(false);
        }
    };

    // Function to perform a Quick Master Setup for all 5 grid formats
    const handleMasterSync = async () => {
        if (!selectedTheme || !isMasterMode) return;

        if (!confirm(`Deseja configurar AUTOMATICAMENTE os 5 formatos baseando-se nestas margens (${layoutConfig.marginTop}mm topo, ${layoutConfig.marginLeft}mm lateral)?\n\nIsso aplicará as cores atuais e definirá ajustes inteligentes de fontes, fotos e gaps para cada grade.`)) {
            return;
        }

        setIsSaving(true);
        try {
            const themeRef = doc(db, 'themes', selectedTheme.id);
            const batchUpdate: any = {
                updatedAt: new Date(),
                configuredFormats: GRID_FORMATS.map(f => f.key),
                isConfigured: true
            };

            const currentGridConfigs = selectedTheme.gridConfigs || {};
            const updatedGridConfigs = { ...currentGridConfigs };

            GRID_FORMATS.forEach(f => {
                // Usar os novos defaults oficiais como base
                const formatDefaults = GRID_CONFIG_DEFAULTS[f.key] || {};

                updatedGridConfigs[f.key] = {
                    layoutConfig: {
                        ...layoutConfig, // Mantém cores e preferências gerais
                        ...formatDefaults, // Aplica os novos padrões oficiais (margens, gaps, fontes)
                        columns: f.columns,
                        rows: f.rows,
                        // Garantir que as cores e textos do usuário sejam mantidos se já configurados
                        colorDescription: layoutConfig.colorDescription,
                        colorPrice: layoutConfig.colorPrice,
                        colorInternalCode: layoutConfig.colorInternalCode,
                        colorEan: layoutConfig.colorEan,
                    },
                    isConfigured: true
                };
            });

            batchUpdate.gridConfigs = updatedGridConfigs;

            await updateDoc(themeRef, batchUpdate);

            // Sync local state
            const updatedTheme = {
                ...selectedTheme,
                gridConfigs: updatedGridConfigs,
                configuredFormats: batchUpdate.configuredFormats,
                isConfigured: true
            };
            setSelectedTheme(updatedTheme);
            setThemes(prev => prev.map(t => t.id === selectedTheme.id ? updatedTheme : t));

            // Refresca o layoutConfig atual para o formato selecionado
            if (updatedGridConfigs[selectedGridFormat]) {
                setLayoutConfig(updatedGridConfigs[selectedGridFormat]!.layoutConfig);
            }

            alert("✨ Tudo pronto! O 'Ajuste Mestre' configurou todos os 5 formatos com escalas de fonte e foto proporcionais.\n\nVerifique cada formato clicando nos botões de grade.");
        } catch (error) {
            console.error(error);
            alert("Erro ao realizar ajuste mestre.");
        } finally {
            setIsSaving(false);
        }
    };

    // Function to re-sync company settings with the latest global baseline
    const handleSyncWithGlobal = async () => {
        if (!selectedTheme || !userData?.companyId || isMasterMode) return;

        if (!confirm("O tema global foi atualizado com melhorias. Deseja re-sincronizar suas configurações?\n\nIsso aplicará as novas padrões globais (cores, tamanhos, posições) mas manterá seus textos personalizados.\n\nEsta ação não pode ser desfeita.")) {
            return;
        }

        setIsSaving(true);
        try {
            // Get fresh global theme data
            const themeRef = doc(db, 'themes', selectedTheme.id);
            const themeSnap = await getDoc(themeRef);
            if (!themeSnap.exists()) throw new Error("Tema não encontrado");
            const freshThemeData = themeSnap.data() as Theme;

            // Start with global baseline
            let mergedConfig = { ...DEFAULT_LAYOUT_CONFIG };
            if (freshThemeData.defaultLayoutConfig) {
                mergedConfig = deepMerge(mergedConfig, freshThemeData.defaultLayoutConfig);
            }

            // Keep only the company-specific texts from the current layoutConfig
            const currentTexts = {
                promoMonth: { text: layoutConfig.promoMonth?.text, visible: layoutConfig.promoMonth?.visible },
                promoBadge: { text: layoutConfig.promoBadge?.text, visible: layoutConfig.promoBadge?.visible },
                sideTextConfig: { text: layoutConfig.sideTextConfig?.text, visible: layoutConfig.sideTextConfig?.visible }
            };

            // Apply current texts back to the global baseline
            if (mergedConfig.promoMonth) mergedConfig.promoMonth = { ...mergedConfig.promoMonth, ...currentTexts.promoMonth };
            if (mergedConfig.promoBadge) mergedConfig.promoBadge = { ...mergedConfig.promoBadge, ...currentTexts.promoBadge };
            if (mergedConfig.sideTextConfig) mergedConfig.sideTextConfig = { ...mergedConfig.sideTextConfig, ...currentTexts.sideTextConfig };

            // Save back to company settings
            const settingsId = `${userData.companyId}_${selectedTheme.id}`;
            const settingsRef = doc(db, 'company_theme_settings', settingsId);

            await setDoc(settingsRef, {
                companyId: userData.companyId,
                themeId: selectedTheme.id,
                layoutConfig: mergedConfig,
                updatedAt: new Date()
            }, { merge: true });

            setLayoutConfig(mergedConfig);
            setThemeHasUpdates(false);
            setCompanyLastSync(new Date());

            alert("✅ Sincronização concluída! Seu tema foi atualizado com as melhorias globais mantendo seus textos.");
        } catch (error) {
            console.error(error);
            alert("Erro ao sincronizar com global.");
        } finally {
            setIsSaving(false);
        }
    };

    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const orchestratorRef = useRef<FlyerExportOrchestratorRef>(null);

    const handleExport = async (type: 'jpg-current' | 'jpg-all' | 'pdf-current' | 'pdf-all') => {
        if (!orchestratorRef.current) {
            alert('Aguarde o carregamento do módulo de exportação.');
            return;
        }

        setShowDownloadMenu(false);

        // --- Stats Tracking ---
        try {
            const productCount = type.includes('all') ? pages.flat().length : (pages[currentPreviewPage]?.length || 0);
            await addDoc(collection(db, 'generated_assets'), {
                type: 'encarte',
                format: type,
                productCount,
                companyId: userData?.companyId || 'unknown',
                userId: userData?.uid || 'unknown',
                userName: userData?.name || 'unknown',
                createdAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error tracking export stats", err);
        }

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

    const [showWhatsappMenu, setShowWhatsappMenu] = useState(false);
    const handleSendToWhatsapp = async (pageIndex?: number) => {
        if (!orchestratorRef.current || pages.length === 0) return;
        setShowWhatsappMenu(false);

        const formatPhoneToE164 = (phone: string) => {
            let cleaned = phone.replace(/\D/g, '');
            if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
            if (cleaned.length === 10 || cleaned.length === 11) {
                cleaned = '55' + cleaned;
            }
            return cleaned;
        };

        // 1. Check/Prompt for Phone Number
        let userPhone = userData?.phone ? formatPhoneToE164(userData.phone) : '';

        if (!userPhone || userPhone.length < 12) {
            setPendingWhatsappSend(pageIndex ?? -1);
            setTempPhone(userData?.phone || '');
            setShowPhoneModal(true);
            return;
        }

        setIsSendingWhatsapp(true);
        setStatusMessage("Iniciamos o processamento para WhatsApp...");
        try {
            const blobs = await orchestratorRef.current.generateImages(pageIndex);

            setStatusMessage("Subindo imagens para nuvem...");
            // 3. Upload blobs to R2 in parallel
            const uploadPromises = blobs.map(async (blob, i) => {
                const file = new File([blob], `encarte-p${i + 1}.jpg`, { type: 'image/jpeg' });
                return uploadToR2(file, 'whatsapp-temp');
            });
            const imageUrls = await Promise.all(uploadPromises);

            // 4. Prepare payload
            const currentCompany = userData?.memberships?.find(m => m.companyId === userData.companyId);
            const payload = {
                solicitante: userData?.displayName || 'Desconhecido',
                empresa: currentCompany?.companyName || userData?.companyId || 'N/A',
                contato: userPhone,
                email: userData?.email || 'N/A',
                imagens: imageUrls,
                timestamp: new Date().toISOString()
            };

            setStatusMessage("Acionando notificações...");
            // 5. Trigger Webhook via WebhookService
            if (userData?.companyId) {
                // Not blocking the UI for webhook failures
                triggerWebhook(userData.companyId, WebhookEvent.FLYER_ART_GENERATED, {
                    solicitante: userData?.displayName || 'Desconhecido',
                    empresa: currentCompany?.companyName || userData?.companyId || 'N/A',
                    contato: userPhone,
                    email: userData?.email || 'N/A',
                    imagens: imageUrls
                }).catch(err => console.error("WebhookService error:", err));
            }

            // 6. Legacy Webhook (with AbortController for timeout)
            const legacyWebhookUrl = 'https://n8n.canvazap.com.br/webhook/71027f63-976d-4dd1-adaf-abbf83ecb919';

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch(legacyWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    alert("Encarte enviado para o WhatsApp com sucesso!");
                } else {
                    console.warn("Legacy webhook failed with status:", response.status);
                    alert("Encarte gerado, mas houve um atraso na notificação do WhatsApp. Tente baixar as imagens manualmente se necessário.");
                }
            } catch (err) {
                console.error("Legacy webhook failed or timed out:", err);
                alert("Encarte gerado! Devido à lentidão na rede, a notificação automática pode demorar. Você já pode baixar as imagens se preferir.");
            }

        } catch (error) {
            console.error("Erro ao enviar para WhatsApp:", error);
            alert("Falha ao processar encarte. Verifique sua internet e tente baixar o JPG manualmente.");
        } finally {
            setIsSendingWhatsapp(false);
            setStatusMessage('');
        }
    };

    const processInput = async () => {
        if (!inputText.trim()) return;

        const lines = inputText.split('\n').filter(l => l.trim().length > 0);
        const newProducts: ProductItem[] = [];

        lines.forEach((line, index) => {
            let processedLine = line.trim();

            // Ignorar linhas de cabeçalho comuns (que contêm "EAN" ou "Código" mas não são dados)
            if (/^(cod|código|ean|produto|descrição)/i.test(processedLine) && !/\d{8,}/.test(processedLine)) {
                return;
            }

            // 1. Extract EAN (Sequence of 8 to 14 digits) - Strongest Anchor
            // We look for the last sequence of 7-14 digits to avoid confusing with internal code
            let ean = '';
            const eanMatch = processedLine.match(/(\d{7,14})\s*$/); // EAN usually at the end
            if (eanMatch) {
                ean = eanMatch[1];
                processedLine = processedLine.replace(eanMatch[0], '').trim();
            } else {
                // Try finding anywhere if not at end
                const anyEanMatch = processedLine.match(/\b(\d{7,14})\b/);
                if (anyEanMatch && parseInt(anyEanMatch[1]) > 999999) { // Avoid short codes misidentified as EAN
                    ean = anyEanMatch[1];
                    processedLine = processedLine.replace(anyEanMatch[0], '').trim();
                }
            }

            // 2. Extract Price (R$ XX,XX or just XX,XX)
            let price = '';
            // Regex for price: R$ followed by digits,dots,comma
            const priceMatch = processedLine.match(/(R\$ ?)?\s*(\d{1,3}(\.\d{3})*,\d{2})/);
            if (priceMatch) {
                price = priceMatch[2]; // Capture just the number part
                processedLine = processedLine.replace(priceMatch[0], '').trim();
            } else {
                // Try simpler float match if R$ missing
                const simplePrice = processedLine.match(/\b\d+,\d{2}\b/);
                if (simplePrice) {
                    price = simplePrice[0];
                    processedLine = processedLine.replace(simplePrice[0], '').trim();
                }
            }

            // 3. Extract Internal Code (Digits at start of line)
            let internalCode = '';
            const codeMatch = processedLine.match(/^(\d+)\s+/);
            // Only consider it a code if it's separate from the description (followed by space) -> and length < 7 usually
            if (codeMatch && codeMatch[1].length < 8) {
                internalCode = codeMatch[1];
                processedLine = processedLine.replace(codeMatch[0], '').trim();
            }

            // 4. Packaging (Simple heuristc: 000g, 1kg, 2L, un, cx)
            let packaging = '';
            const packMatch = processedLine.match(/\b(\d+(g|kg|ml|l|un|cx)|cx|un|pc|pç|fardo)\b/i);
            if (packMatch) {
                packaging = packMatch[0];
                // Don't remove packaging from description as it's often part of the name, 
                // but we can optionally clean it if desired. Let's keep it in name for safety, 
                // just filling the field.
            }

            // 5. Remaining is Description
            // Cleanup tabs or extra spaces
            let description = processedLine.replace(/\s+/g, ' ').trim();

            if (description || ean || internalCode) {
                newProducts.push({
                    id: `p-${Date.now()}-${index}`,
                    rawText: line,
                    description: description || 'Produto sem nome',
                    price: price,
                    ean: ean.replace(/\D/g, ''),
                    internalCode: internalCode,
                    category: 'Geral',
                    packaging: packaging,
                    candidateUrls: [],
                    loadingFirestore: true,
                    isLinked: false
                });
            }
        });

        if (newProducts.length === 0) {
            alert("Nenhum produto identificado. Tente copiar e colar apenas os dados, linha por linha.");
            return;
        }

        setProducts(newProducts);
        setSelectedCategory('all');
        setActiveTab('theme');
        setCurrentPreviewPage(0);

        // Trigger verification
        newProducts.forEach((p, i) => {
            checkFirestoreForProduct(p, i);
        });
    };

    const checkFirestoreForProduct = async (product: ProductItem, index: number) => {
        try {
            const isPriorityCompany = userData?.imageBankSettings?.priority === 'company';
            const bankSettings = userData?.imageBankSettings;
            let finalImageUrl = '';
            let hasFoundImage = false;
            let resolvedEan = product.ean;

            // --- 1. MAPPING CHECK (Internal Code -> EAN) ---
            if (!resolvedEan && product.internalCode && userData?.companyId && (bankSettings?.searchByInternalCode !== false)) {
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
                } catch (err) { console.error("Error checking mappings", err); }
            }

            // --- 2. SEARCH STRATEGY DEFINITION ---
            const codeToUse = resolvedEan || product.internalCode;
            const updatedCandidates = [...product.candidateUrls];

            let customUrl = '';
            if (bankSettings?.customUrl) {
                const nameSlug = product.description ? product.description.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') : '';
                customUrl = bankSettings.customUrl
                    .replace(/{{code}}|{{ean}}/gi, codeToUse || '')
                    .replace(/{{name}}/gi, nameSlug);
            }

            const globalEncartesUrl = resolvedEan ? `https://imagens.canvazap.com.br/codbarras/${resolvedEan}.png` : '';
            const globalFallbackUrl = resolvedEan ? `https://cdn-cosmos.bluesoft.com.br/products/${resolvedEan}` : '';

            // --- 3. EXECUTE LOOKUP WITH PRIORITY ---
            let foundData: any = null;

            // A. Search by Code or Custom URL
            if (codeToUse || customUrl) {
                // Determine order of URLs to check based on priority
                const urlsToCheck = [];
                if (isPriorityCompany && customUrl) urlsToCheck.push(customUrl);
                if (globalEncartesUrl) urlsToCheck.push(globalEncartesUrl);
                if (!isPriorityCompany && customUrl) urlsToCheck.push(customUrl);
                if (globalFallbackUrl) urlsToCheck.push(globalFallbackUrl);

                for (const url of urlsToCheck) {
                    if (!url) continue;
                    if (!updatedCandidates.includes(url)) updatedCandidates.unshift(url);
                    const exists = await checkImageExists(url);
                    if (exists) {
                        finalImageUrl = url;
                        hasFoundImage = true;
                        break;
                    }
                }

                // If no direct image found, check Firestore for metadata (Priority: Private > Global)
                if (!hasFoundImage) {
                    if (userData?.companyId) {
                        const privateId = `${userData.companyId}_${codeToUse}`;
                        const snapPriv = await getDoc(doc(db, 'products', privateId));
                        if (snapPriv.exists()) foundData = snapPriv.data();
                    }
                    if (!foundData && resolvedEan) {
                        const qEan = query(collection(db, 'products'), where('ean', '==', resolvedEan), where('isGlobal', '==', true));
                        const snapEan = await getDocs(qEan);
                        if (!snapEan.empty) foundData = snapEan.docs[0].data();
                    }
                }
            }

            // B. Search by Name (if enabled and still nothing found)
            if (!hasFoundImage && !foundData && product.description && (bankSettings?.searchByName !== false)) {
                if (userData?.companyId) {
                    const qPrivName = query(collection(db, 'products'),
                        where('companyId', '==', userData.companyId),
                        where('name', '==', product.description)
                    );
                    const snapPrivName = await getDocs(qPrivName);
                    if (!snapPrivName.empty) foundData = snapPrivName.docs[0].data();
                }

                if (!foundData) {
                    const qName = query(collection(db, 'products'), where('name', '==', product.description), where('isGlobal', '==', true));
                    const snapName = await getDocs(qName);
                    if (!snapName.empty) foundData = snapName.docs[0].data();
                }
            }

            // --- 4. RESOLVE FINAL IMAGE ---
            if (!hasFoundImage && foundData?.imageUrl) {
                finalImageUrl = foundData.imageUrl;
                hasFoundImage = true;
            }

            const finalEan = resolvedEan || foundData?.ean || product.ean;

            // Optimization: If found image but not marked in DB, update it
            if (hasFoundImage && finalEan && !foundData?.hasImage) {
                setDoc(doc(db, 'products', finalEan), {
                    hasImage: true,
                    imageUrl: finalImageUrl,
                    updatedAt: new Date()
                }, { merge: true }).catch(() => { });
            }

            setProducts(prev => prev.map(p =>
                p.id === product.id ? {
                    ...p,
                    ean: finalEan,
                    candidateUrls: updatedCandidates,
                    imageUrl: finalImageUrl,
                    loadingFirestore: false,
                    loadingImage: false,
                    isLinked: hasFoundImage
                } : p
            ));
        } catch (e) {
            console.error("Firestore lookup failed", e);
            setProducts(prev => prev.map(p =>
                p.id === product.id ? { ...p, loadingFirestore: false, loadingImage: false } : p
            ));
        }
    };

    const itemsPerPage = layoutConfig.columns * layoutConfig.rows;
    const filteredByCategory = products.filter(p => selectedCategory === 'all' || p.category === selectedCategory);
    const linkedProducts = filteredByCategory.filter(p => p.isLinked);
    const filteredForPages = showOnlyWithPhoto ? linkedProducts : filteredByCategory;
    const missingCount = filteredByCategory.length - linkedProducts.length;
    const totalPages = Math.ceil(filteredForPages.length / itemsPerPage);
    const pages = Array.from({ length: totalPages }, (_, i) => filteredForPages.slice(i * itemsPerPage, (i + 1) * itemsPerPage));

    useEffect(() => {
        if (currentPreviewPage >= totalPages && totalPages > 0) {
            setCurrentPreviewPage(totalPages - 1);
        }
    }, [totalPages, currentPreviewPage]);

    return (
        <div className="fade-in module-container">
            {/* Restore Draft Modal */}
            {showRestorePrompt && savedDraft && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                background: '#eff6ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem'
                            }}>
                                <Layers size={28} color="var(--primary-color)" />
                            </div>
                            <h2 style={{ margin: 0, color: '#1f2937' }}>Continuar de onde parou?</h2>
                            <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                Encontramos um encarte salvo com <strong>{savedDraft.products.length} produto(s)</strong>
                            </p>
                            <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                                Salvo em {new Date(savedDraft.savedAt).toLocaleString('pt-BR')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleDiscardDraft}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    background: 'white',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Começar Novo
                            </button>
                            <button
                                onClick={handleRestoreDraft}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="module-layout">
                {/* Sidebar Controls */}
                <div className="module-sidebar glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Tabs Header */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            className={`sidebar-tab ${activeTab === 'products' ? 'active' : ''}`}
                            onClick={() => setActiveTab('products')}
                            style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'products' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'products' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'products' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                        >
                            <Type size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Produtos
                        </button>
                        <button
                            className={`sidebar-tab ${activeTab === 'theme' ? 'active' : ''}`}
                            onClick={() => setActiveTab('theme')}
                            style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'theme' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'theme' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'theme' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                        >
                            <Layout size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> Tema
                        </button>
                        {(isMasterMode || userData?.role === 'admin' || userData?.isSystemAdmin) && (
                            <button
                                className={`sidebar-tab ${activeTab === 'layout' ? 'active' : ''}`}
                                onClick={() => setActiveTab('layout')}
                                style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'layout' ? 'var(--surface-color)' : 'transparent', fontWeight: 600, borderBottom: activeTab === 'layout' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', color: activeTab === 'layout' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                            >
                                <Settings size={18} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} /> {isMasterMode ? 'Baseline' : 'Ajustes'}
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                                {filterOnlyMissing ? `${unavailableProducts.length} Itens pendentes` : `${products.length} Itens detectados`}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm("Deseja limpar toda a lista de produtos?")) setProducts([]);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Trash2 size={12} /> Limpar Lista
                                            </button>
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

                                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
                                                placeholder="Buscar na lista..."
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
                                                    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

                                                    return matchesSearch && matchesMissing && matchesCategory;
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
                                                                {p.description} {p.packaging && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.7rem' }}>({p.packaging})</span>}
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px', alignItems: 'flex-end' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{p.price}</span>
                                                                    {p.category && (
                                                                        <span style={{ fontSize: '0.65rem', background: 'var(--bg-color)', color: 'var(--text-muted)', padding: '1px 4px', borderRadius: '4px', width: 'fit-content' }}>
                                                                            {p.category}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', opacity: 0.6, fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                                                    {p.internalCode && <span>Cód: {p.internalCode}</span>}
                                                                    {p.ean && <span>{p.ean}</span>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            {/* Product Size Selector */}
                                                            <div style={{
                                                                display: 'flex',
                                                                gap: '2px',
                                                                background: '#f1f5f9',
                                                                borderRadius: '4px',
                                                                padding: '2px'
                                                            }}>
                                                                {([1, 2, 3] as const).map(size => {
                                                                    const currentSize = p.sizeMultiplier || 1;
                                                                    const isActive = currentSize === size;
                                                                    return (
                                                                        <button
                                                                            key={size}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setProducts(prev => prev.map(prod =>
                                                                                    prod.id === p.id ? { ...prod, sizeMultiplier: size } : prod
                                                                                ));
                                                                            }}
                                                                            title={size === 1 ? 'Tamanho normal' : `${size}x maior`}
                                                                            style={{
                                                                                width: '22px',
                                                                                height: '22px',
                                                                                border: 'none',
                                                                                borderRadius: '3px',
                                                                                background: isActive ? 'var(--primary-color)' : 'transparent',
                                                                                color: isActive ? 'white' : '#64748b',
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: 700,
                                                                                cursor: 'pointer',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                transition: 'all 0.15s'
                                                                            }}
                                                                        >
                                                                            {size}x
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                id={`upload-${p.id}`}
                                                                style={{ display: 'none' }}
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleUploadImageForProduct(p, file);
                                                                }}
                                                            />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    document.getElementById(`upload-${p.id}`)?.click();
                                                                }}
                                                                title="Upload de imagem personalizada"
                                                                className="btn-icon"
                                                                style={{ width: '28px', height: '28px', color: 'var(--primary-color)' }}
                                                            >
                                                                <Upload size={14} />
                                                            </button>

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

                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setProducts(prev => prev.filter(prod => prod.id !== p.id));
                                                                }}
                                                                title="Remover produto"
                                                                className="btn-icon"
                                                                style={{ width: '28px', height: '28px', color: '#64748b' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'theme' && (
                            <div className="fade-in">
                                {/* Theme Update Alert for Companies */}
                                {themeHasUpdates && !isMasterMode && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #fff7ed, #fffdec)',
                                        border: '1px solid #fdba74',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{
                                                background: '#f97316',
                                                borderRadius: '50%',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Info size={18} color="white" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.95rem' }}>
                                                    Este tema recebeu melhorias globais!
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#c2410c', lineHeight: '1.4' }}>
                                                    O design base deste tema foi atualizado. Considere sincronizar suas configurações para aproveitar as melhorias de margens, cores e posicionamento.
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button
                                                onClick={() => setThemeHasUpdates(false)}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '0.75rem',
                                                    background: 'transparent',
                                                    border: '1px solid #fdba74',
                                                    color: '#9a3412',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600
                                                }}
                                            >
                                                Ignorar
                                            </button>
                                            <button
                                                onClick={handleSyncWithGlobal}
                                                disabled={isSaving}
                                                className="btn"
                                                style={{
                                                    padding: '6px 16px',
                                                    fontSize: '0.8rem',
                                                    background: '#f97316',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    gap: '6px'
                                                }}
                                            >
                                                {isSaving ? <Loader2 size={14} className="loading-spinner" /> : <RefreshCw size={14} />}
                                                Sincronizar Melhorias
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {products.length > 0 && (
                                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                Filtrar por Categoria
                                            </div>

                                            {/* Somente produtos com foto Toggle */}
                                            <button
                                                onClick={() => setShowOnlyWithPhoto(!showOnlyWithPhoto)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: showOnlyWithPhoto ? '#f0fdf4' : '#fff1f1',
                                                    border: `1px solid ${showOnlyWithPhoto ? '#bbf7d0' : '#fecaca'}`,
                                                    borderRadius: '20px',
                                                    padding: '4px 10px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    color: showOnlyWithPhoto ? '#166534' : '#991b1b',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {showOnlyWithPhoto ? <Check size={12} /> : <X size={12} />}
                                                Somente produtos com foto
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                                            <button
                                                onClick={() => setSelectedCategory('all')}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    border: '1px solid var(--border-color)',
                                                    background: selectedCategory === 'all' ? 'var(--primary-color)' : 'white',
                                                    color: selectedCategory === 'all' ? 'white' : 'var(--text-secondary)'
                                                }}
                                            >
                                                Tudo ({products.length})
                                            </button>
                                            {Array.from(new Set(products.map(p => p.category).filter(c => c))).map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedCategory(cat!)}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        border: '1px solid var(--border-color)',
                                                        background: selectedCategory === cat ? 'var(--primary-color)' : 'white',
                                                        color: selectedCategory === cat ? 'white' : 'var(--text-secondary)'
                                                    }}
                                                >
                                                    {cat} ({products.filter(p => p.category === cat).length})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Escolha um Tema</h3>

                                {/* Availability Toggle */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.05)', padding: '0.4rem', borderRadius: '12px' }}>
                                    <button
                                        onClick={() => {
                                            setAvailabilityFilter('encartes');
                                            // Refetch or just rely on state if we filter client side
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: availabilityFilter === 'encartes' ? 'white' : 'transparent',
                                            boxShadow: availabilityFilter === 'encartes' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: availabilityFilter === 'encartes' ? 700 : 500,
                                            color: availabilityFilter === 'encartes' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Encarte
                                    </button>
                                    <button
                                        onClick={() => {
                                            setAvailabilityFilter('catalogo');
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: availabilityFilter === 'catalogo' ? 'white' : 'transparent',
                                            boxShadow: availabilityFilter === 'catalogo' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: availabilityFilter === 'catalogo' ? 700 : 500,
                                            color: availabilityFilter === 'catalogo' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Catálogos
                                    </button>
                                </div>

                                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou tag..."
                                        className="form-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={themeSearch}
                                        onChange={(e) => setThemeSearch(e.target.value)}
                                    />
                                </div>

                                {loadingThemes ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                        {themes.filter(t =>
                                            t.name.toLowerCase().includes(themeSearch.toLowerCase()) ||
                                            (t.tags || []).some(tag => tag.toLowerCase().includes(themeSearch.toLowerCase()))
                                        ).map(theme => (
                                            <div
                                                key={theme.id}
                                                onClick={() => {
                                                    setSelectedTheme(theme);
                                                    // Auto-load layout when theme changes
                                                }}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    border: selectedTheme?.id === theme.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                                                    background: 'white',
                                                    boxShadow: 'var(--shadow-sm)',
                                                    position: 'relative',
                                                    transition: 'transform 0.2s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                                <div style={{ aspectRatio: '1/1', background: '#f5f5f5', overflow: 'hidden', position: 'relative' }}>
                                                    {(theme.coverUrl || theme.backgroundEncartes || theme.imageUrl) ? (
                                                        <img
                                                            src={theme.coverUrl || theme.backgroundEncartes || theme.imageUrl}
                                                            alt={theme.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                                            <ImageIcon size={32} />
                                                        </div>
                                                    )}

                                                    {theme.companyId !== 'global' && (
                                                        <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'var(--primary-color)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 10 }}>
                                                            Interno
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ padding: '0.5rem', textAlign: 'center', background: 'white' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{theme.name}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Grid Format Selection for Clients */}
                                {selectedTheme && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        background: '#f0f9ff',
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #bae6fd'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Grid size={18} color="#0369a1" />
                                            <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' }}>
                                                Formato do Encarte
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                            {GRID_FORMATS.map(format => {
                                                // Check if this format is configured for this theme
                                                const isConfigured = selectedTheme.gridConfigs?.[format.key]?.isConfigured
                                                    || (selectedTheme.isConfigured && selectedTheme.defaultLayoutConfig);
                                                const isActive = layoutConfig.columns === format.columns && layoutConfig.rows === format.rows;

                                                return (
                                                    <button
                                                        key={format.key}
                                                        onClick={() => {
                                                            loadCustomThemeSettings(format.key);
                                                        }}
                                                        disabled={!isConfigured && !selectedTheme.defaultLayoutConfig}
                                                        style={{
                                                            padding: '10px 4px',
                                                            borderRadius: '10px',
                                                            border: isActive ? '2px solid #0369a1' : '2px solid #e0f2fe',
                                                            background: isActive ? 'linear-gradient(135deg, #0369a1, #0ea5e9)' : 'white',
                                                            color: isActive ? 'white' : (!isConfigured && !selectedTheme.defaultLayoutConfig ? '#94a3b8' : '#0369a1'),
                                                            cursor: isConfigured || selectedTheme.defaultLayoutConfig ? 'pointer' : 'not-allowed',
                                                            fontWeight: 600,
                                                            fontSize: '0.8rem',
                                                            textAlign: 'center',
                                                            transition: 'all 0.2s',
                                                            opacity: isConfigured || selectedTheme.defaultLayoutConfig ? 1 : 0.5
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{format.label}</div>
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{format.items} itens</div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div style={{
                                            marginTop: '12px',
                                            padding: '10px',
                                            background: 'white',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            border: '1px solid #e0f2fe'
                                        }}>
                                            <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '1rem' }}>
                                                {layoutConfig.columns} × {layoutConfig.rows} = {layoutConfig.columns * layoutConfig.rows} produtos por página
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Personalização de Textos */}
                                {selectedTheme && (
                                    <details
                                        className="settings-group"
                                        style={{
                                            marginTop: '1.5rem',
                                            background: '#fafafa',
                                            borderRadius: '12px',
                                            border: '1px solid #e5e7eb',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <summary style={{
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            color: '#374151',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: 'white'
                                        }}>
                                            <Type size={18} color="#6b7280" />
                                            Personalizar Textos
                                        </summary>
                                        <div style={{ padding: '1rem', background: 'white' }}>
                                            {/* Texto do Mês */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: '#374151',
                                                    marginBottom: '6px'
                                                }}>
                                                    Mês/Período da Promoção
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: JANEIRO 2026"
                                                        value={layoutConfig.promoMonth?.text || ''}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            promoMonth: {
                                                                ...layoutConfig.promoMonth,
                                                                text: e.target.value,
                                                                visible: e.target.value.length > 0
                                                            }
                                                        })}
                                                        className="form-input"
                                                        style={{ flex: 1, fontSize: '0.9rem' }}
                                                    />
                                                    <input
                                                        type="color"
                                                        value={layoutConfig.promoMonth?.color || '#ffffff'}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            promoMonth: {
                                                                ...layoutConfig.promoMonth,
                                                                color: e.target.value
                                                            }
                                                        })}
                                                        style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            padding: '2px'
                                                        }}
                                                        title="Cor do texto"
                                                    />
                                                </div>
                                            </div>

                                            {/* Badge de Promoção */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: '#374151',
                                                    marginBottom: '6px'
                                                }}>
                                                    Badge/Selo Promocional
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: OFERTAS IMPERDÍVEIS"
                                                        value={layoutConfig.promoBadge?.text || ''}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            promoBadge: {
                                                                ...layoutConfig.promoBadge,
                                                                text: e.target.value,
                                                                visible: e.target.value.length > 0
                                                            }
                                                        })}
                                                        className="form-input"
                                                        style={{ flex: 1, fontSize: '0.9rem' }}
                                                    />
                                                    <input
                                                        type="color"
                                                        value={layoutConfig.promoBadge?.color || '#ffffff'}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            promoBadge: {
                                                                ...layoutConfig.promoBadge,
                                                                color: e.target.value
                                                            }
                                                        })}
                                                        style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            padding: '2px'
                                                        }}
                                                        title="Cor do texto"
                                                    />
                                                </div>
                                            </div>

                                            {/* Texto Lateral */}
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: '#374151',
                                                    marginBottom: '6px'
                                                }}>
                                                    Texto Lateral (Rodapé)
                                                </label>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: www.suaempresa.com.br"
                                                        value={layoutConfig.sideTextConfig?.text || ''}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            sideTextConfig: {
                                                                ...layoutConfig.sideTextConfig,
                                                                text: e.target.value,
                                                                visible: e.target.value.length > 0
                                                            }
                                                        })}
                                                        className="form-input"
                                                        style={{ flex: 1, fontSize: '0.9rem' }}
                                                    />
                                                    <input
                                                        type="color"
                                                        value={layoutConfig.sideTextConfig?.color || '#ffffff'}
                                                        onChange={(e) => setLayoutConfig({
                                                            ...layoutConfig,
                                                            sideTextConfig: {
                                                                ...layoutConfig.sideTextConfig,
                                                                color: e.target.value
                                                            }
                                                        })}
                                                        style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            padding: '2px'
                                                        }}
                                                        title="Cor do texto"
                                                    />
                                                </div>
                                            </div>

                                            {/* Quick Presets for Month */}
                                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    color: '#9ca3af',
                                                    marginBottom: '8px'
                                                }}>
                                                    Sugestões Rápidas:
                                                </label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
                                                        'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map((month, idx) => {
                                                            const fullMonth = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
                                                                'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'][idx];
                                                            return (
                                                                <button
                                                                    key={month}
                                                                    onClick={() => setLayoutConfig({
                                                                        ...layoutConfig,
                                                                        promoMonth: {
                                                                            ...layoutConfig.promoMonth,
                                                                            text: `${fullMonth} 2026`,
                                                                            visible: true
                                                                        }
                                                                    })}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        fontSize: '0.65rem',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #e5e7eb',
                                                                        background: layoutConfig.promoMonth?.text?.includes(fullMonth) ? 'var(--primary-color)' : 'white',
                                                                        color: layoutConfig.promoMonth?.text?.includes(fullMonth) ? 'white' : '#6b7280',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 600
                                                                    }}
                                                                >
                                                                    {month}
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}

                        {missingCount > 0 && products.length > 0 && activeTab === 'theme' && (
                            <div style={{
                                background: '#fff7ed',
                                border: '1px solid #ffedd5',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginTop: '1.5rem',
                                color: '#9a3412',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={20} color="#f97316" />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>Possuímos {linkedProducts.length} de {filteredByCategory.length} imagens</h3>
                                </div>

                                <p style={{ fontSize: '0.7rem', margin: 0, opacity: 0.9, lineHeight: '1.4' }}>
                                    {showOnlyWithPhoto ? 'Itens sem imagem foram ocultados do encarte.' : 'Exibindo todos os itens, inclusive os sem imagem.'} Você pode solicitar o cadastro ou enviar fotos no Banco de Imagens.
                                </p>

                                <button
                                    onClick={handleRequestImages}
                                    disabled={requestingImages}
                                    style={{
                                        background: '#f97316',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        width: '100%'
                                    }}
                                >
                                    {requestingImages ? <Loader2 size={16} className="loading-spinner" /> : <ImagePlus size={16} />}
                                    Solicitar estas imagens
                                </button>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {filteredByCategory.filter(p => !p.isLinked).slice(0, 15).map((p, idx) => (
                                        <div key={idx} style={{
                                            fontSize: '0.65rem',
                                            background: 'white',
                                            padding: '6px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid #ffedd5',
                                            lineHeight: '1.4',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                {p.internalCode && <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Cód: {p.internalCode}</div>}
                                                <div style={{ fontWeight: 800, color: '#9a3412' }}>{p.description}</div>
                                                {p.ean && <div style={{ color: 'var(--text-muted)' }}>EAN: {p.ean}</div>}
                                            </div>
                                            <div style={{ flexShrink: 0 }}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    id={`upload-missing-${p.id}`}
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUploadImageForProduct(p, file);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => document.getElementById(`upload-missing-${p.id}`)?.click()}
                                                    style={{
                                                        background: 'rgba(249, 115, 22, 0.1)',
                                                        color: '#f97316',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        width: '24px',
                                                        height: '24px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Upload rápido"
                                                >
                                                    <Upload size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {missingCount > 15 && (
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f97316', textAlign: 'center', padding: '4px' }}>
                                            + {missingCount - 15} outros itens pendentes
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {activeTab === 'layout' && (isMasterMode || userData?.role === 'admin' || userData?.isSystemAdmin) && (
                            <div className="fade-in">
                                {/* Grid Format Configuration Mode Banner */}
                                {isConfiguringFormat && selectedGridFormat && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        marginBottom: '1.5rem',
                                        color: 'white'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    background: 'rgba(255,255,255,0.2)',
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    fontWeight: 700,
                                                    fontSize: '1.1rem'
                                                }}>
                                                    {GRID_FORMATS.find(f => f.key === selectedGridFormat)?.label}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                                        Configurando Formato
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                                        {selectedTheme?.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleSaveThemeConfig}
                                                className="btn"
                                                style={{
                                                    background: 'white',
                                                    color: '#3b82f6',
                                                    fontWeight: 700,
                                                    gap: '6px'
                                                }}
                                            >
                                                <Save size={16} />
                                                Salvar Formato
                                            </button>
                                        </div>

                                        {/* Quick Navigation to Other Formats */}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {GRID_FORMATS.map(format => {
                                                const isActive = format.key === selectedGridFormat;
                                                const isConfigured = selectedTheme?.configuredFormats?.includes(format.key);
                                                return (
                                                    <button
                                                        key={format.key}
                                                        onClick={() => {
                                                            // Navigate to configure this format
                                                            window.location.href = `/admin/encartes?themeId=${selectedTheme?.id}&gridFormat=${format.key}`;
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 4px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: isActive ? 'white' : (isConfigured ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'),
                                                            color: isActive ? '#3b82f6' : 'white',
                                                            fontWeight: 600,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '2px'
                                                        }}
                                                    >
                                                        <span>{format.key}</span>
                                                        {isConfigured && <Check size={12} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                                        {isConfiguringFormat
                                            ? `Ajustes do Formato ${GRID_FORMATS.find(f => f.key === selectedGridFormat)?.label}`
                                            : (isMasterMode ? 'Ajuste Global' : 'Configurações')}
                                    </h3>
                                    {selectedTheme && !isConfiguringFormat && (
                                        <button
                                            onClick={handleSaveThemeConfig}
                                            className="btn btn-primary"
                                            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
                                            title={isMasterMode ? "Salvar como BASELINE GLOBAL" : "Salvar para minha empresa"}
                                        >
                                            <Save size={16} />
                                            {isMasterMode ? 'Salvar Global' : 'Salvar'}
                                        </button>
                                    )}
                                </div>

                                {/* Master Sync/Setup - Super Admin Only */}
                                {isMasterMode && selectedTheme && !isConfiguringFormat && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                                        border: '1px solid #86efac',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        marginBottom: '1.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#166534' }}>
                                            <Layers size={18} />
                                            <span style={{ fontWeight: 700 }}>Ajuste Mestre (5 Formatos)</span>
                                        </div>

                                        <p style={{ fontSize: '0.75rem', color: '#15803d', marginBottom: '12px', lineHeight: '1.3' }}>
                                            Configure as margens principais (Cabeçalho e Laterais) uma vez e aplicaremos automaticamente em todos os formatos do tema com gaps inteligentes.
                                        </p>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>Topo (mm)</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={layoutConfig.marginTop}
                                                    onChange={e => setLayoutConfig({ ...layoutConfig, marginTop: Number(e.target.value) })}
                                                    style={{ height: '36px', fontSize: '0.85rem', borderColor: '#86efac' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>Laterais (mm)</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={layoutConfig.marginLeft}
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setLayoutConfig({ ...layoutConfig, marginLeft: val, marginRight: val });
                                                    }}
                                                    style={{ height: '36px', fontSize: '0.85rem', borderColor: '#86efac' }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleMasterSync}
                                            disabled={isSaving}
                                            className="btn"
                                            style={{
                                                width: '100%',
                                                background: '#16a34a',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                padding: '10px',
                                                gap: '8px',
                                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                                            }}
                                        >
                                            {isSaving ? <Loader2 size={16} className="loading-spinner" /> : <RefreshCw size={16} />}
                                            Configurar Todos os Formatos
                                        </button>
                                    </div>
                                )}



                                {/* Section: Cores */}
                                <details className="settings-group" open>
                                    <summary>Cores</summary>
                                    <div className="settings-content">
                                        <div className="form-group row">
                                            <label>Cor Nome Produto</label>
                                            <input type="color" value={layoutConfig.colorDescription} onChange={e => setLayoutConfig({ ...layoutConfig, colorDescription: e.target.value })} />
                                        </div>
                                        <div className="form-group row">
                                            <label>Cor Preço</label>
                                            <input type="color" value={layoutConfig.colorPrice} onChange={e => setLayoutConfig({ ...layoutConfig, colorPrice: e.target.value })} />
                                        </div>
                                        <div className="form-group row">
                                            <label>Cor Código Interno</label>
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
                                                        {item === 'code' ? 'Códigos (Cód/EAN)' : item === 'description' ? 'Nome do Produto' : 'Preço Principal'}
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
                                    </div>
                                </details>

                                {/* Section: Layout */}
                                <details className="settings-group" open>
                                    <summary>Layout (Grade e Margens)</summary>
                                    <div className="settings-content">
                                        {/* Grid Presets - Formatos Predefinidos */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Formatos Rápidos:</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                {GRID_FORMATS.map(preset => {
                                                    const isActive = layoutConfig.columns === preset.columns && layoutConfig.rows === preset.rows;

                                                    const handleSwitchFormat = () => {
                                                        loadCustomThemeSettings(preset.key);

                                                        if (isMasterMode) {
                                                            setSelectedGridFormat(preset.key);
                                                            setIsConfiguringFormat(true);
                                                        }
                                                    };

                                                    return (
                                                        <button
                                                            key={preset.key}
                                                            onClick={handleSwitchFormat}
                                                            style={{
                                                                padding: '10px 8px',
                                                                borderRadius: '8px',
                                                                border: isActive ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                                                                background: isActive ? 'var(--primary-color)' : 'white',
                                                                color: isActive ? 'white' : '#64748b',
                                                                cursor: 'pointer',
                                                                fontWeight: isActive ? 700 : 500,
                                                                fontSize: '0.85rem',
                                                                textAlign: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{preset.label}</div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{preset.items} itens</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Custom Grid Controls */}
                                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', display: 'block' }}>Personalizado:</label>
                                            <div className="form-group">
                                                <label>Colunas: {layoutConfig.columns}</label>
                                                <input type="range" min="1" max="6" value={layoutConfig.columns} onChange={e => setLayoutConfig({ ...layoutConfig, columns: Number(e.target.value) })} />
                                            </div>
                                            <div className="form-group">
                                                <label>Linhas: {layoutConfig.rows}</label>
                                                <input type="range" min="1" max="8" value={layoutConfig.rows} onChange={e => setLayoutConfig({ ...layoutConfig, rows: Number(e.target.value) })} />
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '8px', background: '#eff6ff', borderRadius: '6px', marginTop: '8px' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                                                    {layoutConfig.columns} x {layoutConfig.rows} = {layoutConfig.columns * layoutConfig.rows} produtos por página
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                            <div><label>Topo (Unidades)</label><input className="form-input" type="number" value={layoutConfig.marginTop} onChange={e => setLayoutConfig({ ...layoutConfig, marginTop: Number(e.target.value) })} /></div>
                                            <div><label>Base (Unidades)</label><input className="form-input" type="number" value={layoutConfig.marginBottom} onChange={e => setLayoutConfig({ ...layoutConfig, marginBottom: Number(e.target.value) })} /></div>
                                            <div><label>Esq (Unidades)</label><input className="form-input" type="number" value={layoutConfig.marginLeft} onChange={e => setLayoutConfig({ ...layoutConfig, marginLeft: Number(e.target.value) })} /></div>
                                            <div><label>Dir (Unidades)</label><input className="form-input" type="number" value={layoutConfig.marginRight} onChange={e => setLayoutConfig({ ...layoutConfig, marginRight: Number(e.target.value) })} /></div>
                                        </div>
                                        <div style={{ marginTop: '12px', padding: '10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                            <p style={{ fontSize: '0.7rem', color: '#92400e', margin: 0, fontWeight: 700 }}>⚠️ REGRA DE OURO: MARGENS</p>
                                            <p style={{ fontSize: '0.65rem', color: '#92400e', margin: 0, marginTop: '4px' }}>O conteúdo é recortado no limite desta margem. Se o card sumir, diminua a 'Escala da Caixa'.</p>
                                        </div>
                                    </div>
                                </details>

                                {/* Section: Espaçamentos (Card) */}
                                <details className="settings-group" open>
                                    <summary>Espaçamentos e Distâncias</summary>
                                    <div className="settings-content">
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espaçamento entre Cards (px)</label>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Horizontal: {layoutConfig.gap}</label>
                                                    <input type="range" min="0" max="100" value={layoutConfig.gap} onChange={e => setLayoutConfig({ ...layoutConfig, gap: Number(e.target.value) })} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Vertical: {layoutConfig.rowGap !== undefined ? layoutConfig.rowGap : layoutConfig.gap}</label>
                                                    <input type="range" min="0" max="100" value={layoutConfig.rowGap !== undefined ? layoutConfig.rowGap : layoutConfig.gap} onChange={e => setLayoutConfig({ ...layoutConfig, rowGap: Number(e.target.value) })} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ background: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                                            <label style={{ fontWeight: 700, color: '#9a3412' }}>Padding Interno (px): {layoutConfig.cardPadding}</label>
                                            <p style={{ fontSize: '0.65rem', color: '#9a3412', marginBottom: '5px' }}>
                                                Diminua para o conteúdo (foto e texto) encostar mais nas bordas.
                                            </p>
                                            <input type="range" min="0" max="60" value={layoutConfig.cardPadding} onChange={e => setLayoutConfig({ ...layoutConfig, cardPadding: Number(e.target.value) })} />
                                        </div>

                                        <div className="form-group" style={{ marginTop: '12px' }}>
                                            <label>Abaixo da Foto (px)</label>
                                            <input className="form-input" type="number" value={layoutConfig.spacingBelowPhoto} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowPhoto: Number(e.target.value) })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Abaixo do Nome (px)</label>
                                            <input className="form-input" type="number" value={layoutConfig.spacingBelowDescription} onChange={e => setLayoutConfig({ ...layoutConfig, spacingBelowDescription: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                </details>

                                {/* Section: Ajustes da Foto */}
                                <details className="settings-group" open>
                                    <summary>Ajustes da Foto</summary>
                                    <div className="settings-content">
                                        <div className="form-group">
                                            <label>Escala da Imagem (%): {Math.round(layoutConfig.photoScale * 100)}</label>
                                            <input type="range" min="0" max="1.5" step="0.05" value={layoutConfig.photoScale} onChange={e => setLayoutConfig({ ...layoutConfig, photoScale: Number(e.target.value) })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Altura da Área (%): {layoutConfig.photoAreaHeight}</label>
                                            <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px' }}>
                                                Aumente para a foto ocupar mais espaço vertical no card.
                                            </p>
                                            <input type="range" min="30" max="150" step="5" value={layoutConfig.photoAreaHeight || 70} onChange={e => setLayoutConfig({ ...layoutConfig, photoAreaHeight: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                </details>

                                {/* Section: Tamanho Geral do Card */}
                                <details className="settings-group" open>
                                    <summary>Tamanho Geral (Caixa)</summary>
                                    <div className="settings-content">
                                        <div className="form-group">
                                            <label style={{ color: 'var(--primary-color)', fontWeight: 700 }}>Escala da Caixa (%): {Math.round((layoutConfig.cardScale || 1) * 100)}</label>
                                            <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px' }}>
                                                Aumenta/diminui TUDO junto (Fundo, Foto, Textos e Preços).
                                            </p>
                                            <input
                                                type="range"
                                                min="0.4"
                                                max="2.0"
                                                step="0.05"
                                                value={layoutConfig.cardScale || 1}
                                                onChange={e => setLayoutConfig({ ...layoutConfig, cardScale: Number(e.target.value) })}
                                                style={{ accentColor: 'var(--primary-color)' }}
                                            />
                                        </div>
                                    </div>
                                </details>

                                {/* Section: Ajustes de Tipografia */}
                                <details className="settings-group">
                                    <summary>Ajustes de Tipografia</summary>
                                    <div className="settings-content">
                                        <div className="form-group">
                                            <label>Tam. Nome Produto (rem)</label>
                                            <input className="form-input" type="number" step="0.1" value={layoutConfig.fontSizeDescription} onChange={e => setLayoutConfig({ ...layoutConfig, fontSizeDescription: Number(e.target.value) })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Tam. Preço (rem)</label>
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
                                            <label>Tam. Código Interno (rem)</label>
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
                                            <div><label>Pos Y (%)</label><input className="form-input" type="number" value={layoutConfig.sideTextConfig.y} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, y: Number(e.target.value) } })} /></div>
                                        </div>
                                        <div className="form-group">
                                            <label>Rotação (graus)</label>
                                            <input className="form-input" type="number" value={layoutConfig.sideTextConfig.rotation} onChange={e => setLayoutConfig({ ...layoutConfig, sideTextConfig: { ...layoutConfig.sideTextConfig, rotation: Number(e.target.value) } })} />
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--border-color)', margin: '15px 0' }}></div>

                                        <h5 style={{ marginBottom: 10, marginTop: 10 }}>Mês da Oferta</h5>
                                        <div className="form-group row">
                                            <label>Habilitar</label>
                                            <input type="checkbox" checked={layoutConfig.promoMonth?.visible ?? false} onChange={e => setLayoutConfig({ ...layoutConfig, promoMonth: { ...(layoutConfig.promoMonth || DEFAULT_LAYOUT_CONFIG.promoMonth), visible: e.target.checked } })} />
                                        </div>
                                        <div className="form-group">
                                            <select
                                                className="form-input"
                                                value={layoutConfig.promoMonth?.text || ''}
                                                onChange={e => setLayoutConfig({
                                                    ...layoutConfig,
                                                    promoMonth: {
                                                        ...(layoutConfig.promoMonth || DEFAULT_LAYOUT_CONFIG.promoMonth),
                                                        text: e.target.value,
                                                        visible: e.target.value !== ''
                                                    }
                                                })}
                                            >
                                                <option value="">Nenhum</option>
                                                {['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'].map(m => (
                                                    <option key={m} value={`MÊS DE ${m}`}>{m}</option>
                                                ))}
                                                <option value="OFERTAS DA SEMANA">OFERTAS DA SEMANA</option>
                                                <option value="OFERTAS DO DIA">OFERTAS DO DIA</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                                            <div><label>Pos Y (px)</label><input className="form-input" type="number" value={layoutConfig.promoMonth?.y ?? 0} onChange={e => setLayoutConfig({ ...layoutConfig, promoMonth: { ...(layoutConfig.promoMonth || DEFAULT_LAYOUT_CONFIG.promoMonth), y: Number(e.target.value) } })} /></div>
                                            <div><label>Fonte (px)</label><input className="form-input" type="number" value={layoutConfig.promoMonth?.fontSize ?? 0} onChange={e => setLayoutConfig({ ...layoutConfig, promoMonth: { ...(layoutConfig.promoMonth || DEFAULT_LAYOUT_CONFIG.promoMonth), fontSize: Number(e.target.value) } })} /></div>
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
                </div>

                {/* Preview Area (Main) */}
                <div className="module-main">

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

                            {/* Export Controls */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ height: '44px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}
                                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                    disabled={pages.length === 0 || isExporting}
                                >
                                    {isExporting ? <Loader2 className="loading-spinner" size={18} /> : <Download size={18} />}
                                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {isExporting ? (statusMessage || 'Gerando...') : 'Baixar Imagem'}
                                    </span>
                                    <ChevronDown size={18} />
                                </button>
                                {showDownloadMenu && (
                                    <div className="glass-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        width: '200px',
                                        padding: '4px',
                                        marginTop: '10px',
                                        overflow: 'hidden',
                                        zIndex: 1000,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                                    }}>
                                        <button className="dropdown-item" onClick={() => handleExport('jpg-current')}>JPG (Página Atual)</button>
                                        <button className="dropdown-item" onClick={() => handleExport('jpg-all')}>JPG (Todas - Zip)</button>
                                        <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                                        <button className="dropdown-item" onClick={() => handleExport('pdf-current')}>PDF (Página Atual)</button>
                                        <button className="dropdown-item" onClick={() => handleExport('pdf-all')}>PDF (Completo)</button>
                                    </div>
                                )}
                            </div>

                            {/* WhatsApp Controls */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="btn"
                                    onClick={() => handleSendToWhatsapp()}
                                    disabled={isSendingWhatsapp || isExporting}
                                    style={{
                                        height: '44px',
                                        padding: '0 1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        borderRadius: '12px 0 0 12px',
                                        background: '#25D366',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 600,
                                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)'
                                    }}
                                >
                                    {isSendingWhatsapp ? <Loader2 className="loading-spinner" size={20} /> : <Smartphone size={20} />}
                                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {isSendingWhatsapp ? (statusMessage || 'Enviando...') : 'WhatsApp'}
                                    </span>
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => setShowWhatsappMenu(!showWhatsappMenu)}
                                    disabled={isSendingWhatsapp || isExporting}
                                    style={{
                                        height: '44px',
                                        padding: '0 0.5rem',
                                        borderRadius: '0 12px 12px 0',
                                        background: '#22c35e',
                                        color: 'white',
                                        border: 'none',
                                        borderLeft: '1px solid rgba(255,255,255,0.2)',
                                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)'
                                    }}
                                >
                                    <ChevronDown size={18} />
                                </button>

                                {showWhatsappMenu && (
                                    <div className="glass-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        width: '220px',
                                        padding: '4px',
                                        marginTop: '10px',
                                        zIndex: 1000,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                                    }}>
                                        <button className="dropdown-item" onClick={() => handleSendToWhatsapp(currentPreviewPage)}>
                                            🚀 Página Atual (Imediato)
                                        </button>
                                        <button className="dropdown-item" onClick={() => handleSendToWhatsapp()}>
                                            📑 Todas as {pages.length} Páginas
                                        </button>
                                    </div>
                                )}
                            </div>

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
                                    border-radius: 8px;
                                    transition: all 0.2s;
                                }
                                .dropdown-item:hover {
                                    background: var(--primary-light);
                                    color: var(--primary-color);
                                }
                            `}</style>
                        </div>
                    )}

                    {pages.map((pageProducts, pageIndex) => {
                        if (pageIndex !== currentPreviewPage) return null; // Show only current page

                        return (
                            <div style={{ position: 'relative' }}>
                                <FlyerPage
                                    key={pageIndex}
                                    products={pageProducts}
                                    pageIndex={pageIndex}
                                    theme={selectedTheme}
                                    layoutConfig={layoutConfig}
                                    companyLogoUrl={companyLogoUrl}
                                    scale={zoomLevel} // Use the zoom level
                                    className="flyer-page-preview"
                                    onLogoClick={logoVariations.length > 0 ? () => setShowLogoSelector(!showLogoSelector) : undefined}
                                    style={{
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                        marginBottom: `${(297 * zoomLevel) - 297}mm`, // Compensate for scale transform origin top
                                        border: '1px solid #e2e8f0'
                                    }}
                                />
                                {showLogoSelector && (
                                    <div className="glass-card fade-in" style={{
                                        position: 'absolute',
                                        left: `calc(${layoutConfig.logoConfig?.x ?? 50}% + 40px)`,
                                        top: `calc(${(layoutConfig.logoConfig?.y ?? 0) * zoomLevel}px + 60px)`,
                                        width: '240px',
                                        padding: '8px',
                                        zIndex: 2000,
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Versões da Marca</div>
                                        {logoVariations.map((url, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectLogo(url)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '8px',
                                                    background: companyLogoUrl === url ? 'var(--primary-light)' : 'transparent',
                                                    border: '1px solid',
                                                    borderColor: companyLogoUrl === url ? 'var(--primary-color)' : 'transparent',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ width: '44px', height: '44px', background: 'white', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '4px' }}>
                                                    <img src={url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: companyLogoUrl === url ? 700 : 500, color: companyLogoUrl === url ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                                    {idx === 0 ? 'Principal' : `Variação ${idx}`}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Export Orchestrator */}
                    <FlyerExportOrchestrator
                        ref={orchestratorRef}
                        pages={pages}
                        theme={selectedTheme}
                        layoutConfig={layoutConfig}
                        companyLogoUrl={companyLogoUrl}
                        onExportStart={() => {
                            setIsExporting(true);
                            setStatusMessage("Iniciando...");
                        }}
                        onExportEnd={() => {
                            setIsExporting(false);
                            setStatusMessage("");
                        }}
                        onProgress={(msg) => setStatusMessage(msg)}
                    />


                    {pages.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', marginTop: '5rem' }}>
                            Adicione produtos e processe para visualizar o encarte.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Registro de WhatsApp (Lead Enrichment) */}
            {showPhoneModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '1rem', backdropFilter: 'blur(8px)'
                }}>
                    <div className="glass-card fade-in" style={{ maxWidth: '450px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#25D366'
                        }}>
                            <Smartphone size={32} />
                        </div>
                        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Vincular WhatsApp</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Para enviar este encarte, precisamos registrar seu número de contato. Isso enriquecerá seu perfil e facilitará futuros envios.
                        </p>

                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label className="form-label">Seu número de WhatsApp</label>
                            <div style={{ position: 'relative' }}>
                                <Smartphone size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="tel"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem', fontSize: '1.1rem' }}
                                    placeholder="(00) 00000-0000"
                                    value={tempPhone}
                                    onChange={e => setTempPhone(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Informe o DDD e o número completo. Ex: 11 99999-9999
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#25D366', borderColor: '#25D366' }}
                                onClick={async () => {
                                    const cleaned = tempPhone.replace(/\D/g, '');
                                    if (cleaned.length < 10) return alert("Por favor, informe um número válido com DDD.");

                                    const formatPhone = (p: string) => {
                                        let c = p.replace(/\D/g, '');
                                        if (c.startsWith('0')) c = c.substring(1);
                                        if (c.length === 10 || c.length === 11) c = '55' + c;
                                        return c;
                                    };

                                    const formatted = formatPhone(tempPhone);

                                    try {
                                        if (userData?.uid) {
                                            await updateDoc(doc(db, 'users', userData.uid), {
                                                phone: formatted,
                                                phoneRegisteredAt: new Date(),
                                                phoneSource: 'flyer_module'
                                            });
                                            await refreshUserData();
                                        }
                                        setShowPhoneModal(false);
                                        // Continue the pending send
                                        const originalPage = pendingWhatsappSend === -1 ? undefined : (pendingWhatsappSend ?? undefined);
                                        handleSendToWhatsapp(originalPage);
                                    } catch (e) {
                                        console.error(e);
                                        alert("Erro ao salvar número. Tente novamente.");
                                    }
                                }}
                            >
                                Registrar e Enviar
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ background: 'transparent' }}
                                onClick={() => setShowPhoneModal(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default FlyersModule;
