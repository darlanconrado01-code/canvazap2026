import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { ProductItem } from './FlyerTypes';
import { LaminaPage } from './LaminaPage';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface LaminaExportOrchestratorRef {
    exportSingleLamina: (index: number) => Promise<void>;
    exportAllLaminas: () => Promise<void>;
}

interface LayoutConfig {
    [key: string]: any;
}

interface LaminaExportOrchestratorProps {
    products: ProductItem[];
    layoutConfig: LayoutConfig;
    companyLogoUrl: string | null;
    selectedFormat: 'feed' | 'post' | 'stories' | 'tv';
    onExportStart?: () => void;
    onExportEnd?: () => void;
    onProgress?: (message: string) => void;
}

export const LaminaExportOrchestrator = forwardRef<LaminaExportOrchestratorRef, LaminaExportOrchestratorProps>((
    {
        products,
        layoutConfig,
        companyLogoUrl,
        selectedFormat,
        onExportStart,
        onExportEnd,
        onProgress
    },
    ref
) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const INT_SCALE = 2; // Sincronizado com LaminaPage

    // Helper robusto para esperar imagens
    const waitForImages = async (element: HTMLElement) => {
        const images = Array.from(element.querySelectorAll('img'));
        const elementsWithBg = Array.from(element.querySelectorAll('*')).filter(el => {
            const bg = window.getComputedStyle(el).backgroundImage;
            return bg && bg !== 'none' && bg.includes('url(');
        });

        const imagePromises = images.map(img => {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(resolve => {
                let finished = false;
                const done = () => { if (!finished) { finished = true; resolve(null); } };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                if (img.complete && img.naturalWidth > 0) done();
                setTimeout(done, 10000);
            });
        });

        const bgPromises = elementsWithBg.map(el => {
            const bg = window.getComputedStyle(el).backgroundImage;
            const urlMatch = bg.match(/url\(["']?([^"']+)["']?\)/);
            if (!urlMatch) return Promise.resolve();
            const url = urlMatch[1];

            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null);
                img.src = url;
                setTimeout(() => resolve(null), 10000);
            });
        });

        await Promise.all([...imagePromises, ...bgPromises]);
        await new Promise(r => setTimeout(r, 1500)); // Estabilização pixels
    };

    const getLaminaElement = (index: number): HTMLElement | null => {
        if (!containerRef.current) return null;
        return containerRef.current.querySelector(`[data-export-lamina="${index}"]`) as HTMLElement;
    };

    const translationCache = useRef<Record<string, string>>({});
    const blobUrls = useRef<string[]>([]);

    const cleanupBlobUrls = () => {
        blobUrls.current.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (e) { }
        });
        blobUrls.current = [];
        translationCache.current = {};
    };

    useEffect(() => {
        return () => cleanupBlobUrls();
    }, []);

    const intermediador = async (url: string | null | undefined): Promise<string> => {
        if (!url || url.length < 5) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        if (translationCache.current[url]) return translationCache.current[url];

        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(url || ''), 15000);

            const downloadAndProcess = async () => {
                try {
                    let response = await fetch(url, { mode: 'cors' }).catch(() => null);
                    if (!response || !response.ok) {
                        const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&n=-1&output=png`;
                        response = await fetch(proxyUrl).catch(() => null);
                    }

                    if (response && response.ok) {
                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const b64 = reader.result as string;
                            translationCache.current[url!] = b64;
                            resolve(b64);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        resolve(url);
                    }
                } catch (err) {
                    resolve(url);
                } finally {
                    clearTimeout(timeout);
                }
            };
            downloadAndProcess();
        });
    };

    const getDimensions = () => {
        let base = { width: 1080, height: 1080 };
        switch (selectedFormat) {
            case 'stories': base = { width: 1080, height: 1920 }; break;
            case 'feed': base = { width: 1080, height: 1350 }; break;
            case 'tv': base = { width: 1920, height: 1080 }; break;
            case 'post': base = { width: 1080, height: 1080 }; break;
        }
        return { width: base.width * INT_SCALE, height: base.height * INT_SCALE };
    };

    const generateCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        await waitForImages(element);
        await document.fonts.ready;

        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 500));

        const dim = getDimensions();

        return await html2canvas(element, {
            scale: 1, // Já está em 2x via LaminaPage
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            logging: false,
            width: dim.width,
            height: dim.height,
            windowWidth: dim.width,
            windowHeight: dim.height,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, el) => {
                const clonedEl = el as HTMLElement;
                clonedDoc.documentElement.style.width = `${dim.width}px`;
                clonedDoc.documentElement.style.height = `${dim.height}px`;
                clonedDoc.body.style.width = `${dim.width}px`;
                clonedDoc.body.style.height = `${dim.height}px`;

                clonedEl.style.opacity = '1';
                clonedEl.style.visibility = 'visible';
                clonedEl.style.transform = 'none';
                clonedEl.style.left = '0';
                clonedEl.style.top = '0';
                clonedEl.style.width = `${dim.width}px`;
                clonedEl.style.height = `${dim.height}px`;

                const body = clonedDoc.body;
                body.style.fontSize = '16px';
                (body.style as any).webkitFontSmoothing = 'antialiased';
                (body.style as any).mozOsxFontSmoothing = 'grayscale';

                const allLaminas = clonedDoc.querySelectorAll('[data-export-lamina]');
                allLaminas.forEach((p: any) => {
                    if (p.getAttribute('data-export-lamina') !== clonedEl.getAttribute('data-export-lamina')) {
                        p.style.setProperty('display', 'none', 'important');
                    }
                });

                const textNodes = clonedEl.querySelectorAll('[data-export-text="true"]');
                textNodes.forEach((node: any) => {
                    node.style.setProperty('overflow', 'visible', 'important');
                    node.style.setProperty('display', 'block', 'important');
                    let p = node.parentElement;
                    while (p && p !== clonedDoc.body) {
                        p.style.setProperty('overflow', 'visible', 'important');
                        p = p.parentElement;
                    }
                });
            }
        });
    };

    const [translatedData, setTranslatedData] = useState<{
        logo: string;
        seal: string;
        productImages: Record<string, string>;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        exportSingleLamina: async (index) => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciando exportação da lâmina...");
            try {
                const product = products[index];
                if (!product) return;

                if (onProgress) onProgress("Preparando imagens...");
                const [logoB64, sealB64, prodB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(layoutConfig.sealUrl),
                    intermediador(product.imageUrl || (product.candidateUrls && product.candidateUrls[0]))
                ]);

                const productImages: Record<string, string> = {};
                productImages[product.id] = prodB64;

                setTranslatedData({ logo: logoB64, seal: sealB64, productImages });
                if (onProgress) onProgress("Renderizando lâmina...");

                await new Promise(r => setTimeout(r, 2000));

                const el = getLaminaElement(index);
                if (!el) throw new Error("Lâmina não encontrada");

                if (onProgress) onProgress("Finalizando arquivo...");
                const canvas = await generateCanvas(el);
                canvas.toBlob(blob => {
                    if (blob) {
                        saveAs(blob, `lamina_${product.ean || index}.png`);
                    }
                    setTranslatedData(null);
                    cleanupBlobUrls();
                }, 'image/png');
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar lâmina.');
                setTranslatedData(null);
                cleanupBlobUrls();
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllLaminas: async () => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciando exportação de todas as lâminas...");
            try {
                // Filtro rigoroso: apenas produtos marcados como vinculados (isLinked)
                const linkedProducts = products.filter(p => p.isLinked);

                if (linkedProducts.length === 0) {
                    alert("Nenhuma lâmina pronta para exportar.");
                    return;
                }

                const zip = new JSZip();
                if (onProgress) onProgress("Processando assets globais...");
                const [logoB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(layoutConfig.sealUrl)
                ]);

                const allProductImages: Record<string, string> = {};
                for (const p of linkedProducts) {
                    allProductImages[p.id] = await intermediador(p.imageUrl || p.candidateUrls?.[0]);
                }

                setTranslatedData({ logo: logoB64, seal: sealB64, productImages: allProductImages });
                // Tempo para o React renderizar o container de exportação com os logos/selos traduzidos
                await new Promise(r => setTimeout(r, 2000));

                for (let i = 0; i < products.length; i++) {
                    const product = products[i];
                    // Pula se não estiver vinculado ou se o asset falhou
                    if (!product.isLinked || !allProductImages[product.id]) continue;

                    const currentIndex = linkedProducts.findIndex(p => p.id === product.id) + 1;
                    if (onProgress) onProgress(`Processando lâmina ${currentIndex} de ${linkedProducts.length}...`);

                    const el = getLaminaElement(i);
                    if (el) {
                        const canvas = await generateCanvas(el);
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (blob) {
                            const fileName = `${currentIndex}_${product.description.substring(0, 30).replace(/[/\\?%*:|"<>]/g, '-')}.png`;
                            zip.file(fileName, blob);
                        }
                    }
                    // Pequeno respiro entre renderizações
                    await new Promise(r => setTimeout(r, 100));
                }

                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `laminas_${selectedFormat}_${Date.now()}.zip`);
                setTranslatedData(null);
                cleanupBlobUrls();
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar lâminas.');
                setTranslatedData(null);
                cleanupBlobUrls();
            } finally {
                if (onExportEnd) onExportEnd();
            }
        }
    }));

    const dim = getDimensions();

    return (
        <div ref={containerRef} style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -9999, width: '6000px', height: '6000px', background: 'white' }}>
            {products.map((product, i) => (
                <div key={product.id || i} data-export-lamina={i} data-export-root="true" style={{ width: `${dim.width}px`, height: `${dim.height}px`, overflow: 'visible', background: 'white', position: 'relative' }}>
                    <LaminaPage
                        product={translatedData?.productImages[product.id]
                            ? { ...product, candidateUrls: [translatedData.productImages[product.id]], imageUrl: translatedData.productImages[product.id] }
                            : product}
                        layoutConfig={translatedData ? { ...layoutConfig, sealUrl: translatedData.seal || layoutConfig.sealUrl } : layoutConfig}
                        companyLogoUrl={translatedData?.logo || companyLogoUrl}
                        selectedFormat={selectedFormat}
                        scale={1}
                        isExport={true}
                        crossOrigin="anonymous"
                    />
                </div>
            ))}
        </div>
    );
});

LaminaExportOrchestrator.displayName = 'LaminaExportOrchestrator';
