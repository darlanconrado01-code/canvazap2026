import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
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

    // Helper robusto para esperar imagens
    const waitForImages = async (element: HTMLElement) => {
        const images = Array.from(element.querySelectorAll('img'));
        const promises = images.map(img => {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
                // Timeout individual para cada imagem
                setTimeout(resolve, 5000);
            });
        });

        // Espera todas as imagens + um buffer de segurança
        await Promise.all(promises);
        await new Promise(r => setTimeout(r, 1000));
    };

    const getLaminaElement = (index: number): HTMLElement | null => {
        if (!containerRef.current) return null;
        return containerRef.current.querySelector(`[data-export-lamina="${index}"]`) as HTMLElement;
    };

    // --- O INTERMEDIADOR (TRADUTOR DE IMAGENS) ---
    const intermediador = async (url: string | null | undefined): Promise<string> => {
        if (!url || url.length < 5) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;

        return new Promise((resolve) => {
            const img = new Image();

            // Timeout de 10 segundos para não travar o export todo se um link morrer
            const timeout = setTimeout(() => {
                img.src = '';
                console.warn("Intermediador timeout para:", url);
                resolve(url);
            }, 10000);

            // Parâmetros para garantir que o weserv não remova a transparência
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&n=-1&output=png`;

            img.crossOrigin = "anonymous";
            img.onload = () => {
                clearTimeout(timeout);
                try {
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
                } catch (e) {
                    resolve(proxyUrl);
                }
            };
            img.onerror = () => {
                clearTimeout(timeout);
                console.error("Intermediador error para:", url);
                resolve(url);
            };
            img.src = proxyUrl;
        });
    };

    // Obter dimensões baseadas no formato
    const getDimensions = () => {
        switch (selectedFormat) {
            case 'stories':
                return { width: 1080, height: 1980 };
            case 'feed':
                return { width: 1080, height: 1350 };
            case 'tv':
                return { width: 1920, height: 1080 };
            case 'post':
            default:
                return { width: 1080, height: 1080 };
        }
    };

    const generateCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        await waitForImages(element);

        // ESPERA POR FONTES - Crucial para evitar texto cortado por atraso de renderização
        await document.fonts.ready;

        // Assentar layout (2 frames)
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        const dimensions = getDimensions();

        return await html2canvas(element, {
            scale: 1, // 1:1 com o render nativo de Camada 2
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            logging: false,
            width: dimensions.width,
            height: dimensions.height,
            windowWidth: dimensions.width,
            windowHeight: dimensions.height,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, el) => {
                const clonedEl = el as HTMLElement;

                clonedDoc.documentElement.style.width = `${dimensions.width}px`;
                clonedDoc.documentElement.style.height = `${dimensions.height}px`;
                clonedDoc.body.style.width = `${dimensions.width}px`;
                clonedDoc.body.style.height = `${dimensions.height}px`;

                clonedEl.style.opacity = '1';
                clonedEl.style.visibility = 'visible';
                clonedEl.style.transform = 'none';
                clonedEl.style.left = '0';
                clonedEl.style.top = '0';
                clonedEl.style.width = `${dimensions.width}px`;
                clonedEl.style.height = `${dimensions.height}px`;

                // Fonte / suavização
                const body = clonedDoc.body;
                body.style.fontSize = '16px';
                (body.style as any).webkitFontSmoothing = 'antialiased';
                (body.style as any).mozOsxFontSmoothing = 'grayscale';
                (body.style as any).webkitTextSizeAdjust = '100%';

                // Targeted Anti-clipping
                const root = clonedEl;

                // Hide all other laminas in the clone to prevent layout interference
                const allLaminas = clonedDoc.querySelectorAll('[data-export-lamina]');
                allLaminas.forEach((p: any) => {
                    const laminaAttr = p.getAttribute('data-export-lamina');
                    const currentAttr = clonedEl.getAttribute('data-export-lamina');
                    if (laminaAttr !== currentAttr) {
                        p.style.setProperty('display', 'none', 'important');
                    }
                });

                const textNodes = root.querySelectorAll('[data-export-text="true"]');
                textNodes.forEach((node: any) => {
                    node.style.setProperty('overflow', 'visible', 'important');
                    node.style.setProperty('display', 'block', 'important');

                    // Subimos até o topo para garantir que nada corte
                    let p = node.parentElement;
                    while (p && p !== clonedDoc.body) {
                        p.style.setProperty('overflow', 'visible', 'important');
                        p = p.parentElement;
                    }
                });
            }
        });
    };

    // State para armazenar os dados traduzidos temporariamente durante o export
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
                if (!product || !product.isLinked) {
                    alert("Produto não encontrado ou sem imagem.");
                    return;
                }

                // ETAPA DE INTERMEDIAÇÃO (TRADUÇÃO)
                if (onProgress) onProgress("Preparando imagens...");
                const [logoB64, sealB64, prodB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(layoutConfig.sealUrl),
                    intermediador(product.imageUrl || product.candidateUrls[0])
                ]);

                const productImages: Record<string, string> = {};
                productImages[product.id] = prodB64;

                setTranslatedData({ logo: logoB64, seal: sealB64, productImages });
                if (onProgress) onProgress("Renderizando lâmina...");

                // Esperar renderização
                await new Promise(r => setTimeout(r, 2000));

                const el = getLaminaElement(index);
                if (!el) throw new Error("Lâmina não encontrada");

                if (onProgress) onProgress("Finalizando arquivo...");
                const canvas = await generateCanvas(el);
                canvas.toBlob(blob => {
                    if (blob) {
                        const fileName = `lamina_${product.ean || index}.png`;
                        saveAs(blob, fileName);
                    }
                    setTranslatedData(null);
                }, 'image/png');
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar lâmina.');
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllLaminas: async () => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciando exportação de todas as lâminas...");
            try {
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

                // Traduzir todos os produtos de uma vez
                const allProductImages: Record<string, string> = {};
                const productPromises = linkedProducts.map(async p => {
                    const src = p.imageUrl || p.candidateUrls[0];
                    if (src) {
                        allProductImages[p.id] = await intermediador(src);
                    }
                });
                await Promise.all(productPromises);

                setTranslatedData({
                    logo: logoB64,
                    seal: sealB64,
                    productImages: allProductImages
                });

                // Esperar renderização inicial
                await new Promise(r => setTimeout(r, 2000));

                for (let i = 0; i < products.length; i++) {
                    const product = products[i];
                    if (!product.isLinked) continue;

                    const currentIndex = linkedProducts.indexOf(product) + 1;
                    if (onProgress) onProgress(`Processando lâmina ${currentIndex} de ${linkedProducts.length}...`);

                    const el = getLaminaElement(i);
                    if (el) {
                        const canvas = await generateCanvas(el);
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (blob) {
                            const fileName = `${i + 1}_${product.description.substring(0, 30).replace(/[/\\?%*:|"<>]/g, '-')}.png`;
                            zip.file(fileName, blob);
                        }
                    }

                    // Pequeno delay entre lâminas
                    await new Promise(r => setTimeout(r, 500));
                }

                const content = await zip.generateAsync({ type: 'blob' });
                if (onProgress) onProgress("Finalizando download...");
                saveAs(content, `laminas_${Date.now()}.zip`);
                setTranslatedData(null);
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar lâminas.');
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        }
    }));

    const dimensions = getDimensions();

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: '-9999px',
                zIndex: -9999,
                width: '4000px',
                height: '4000px',
                background: 'white'
            }}
        >
            {products.map((product, i) => (
                <div
                    key={product.id || i}
                    data-export-lamina={i}
                    data-export-root="true"
                    style={{
                        width: `${dimensions.width}px`,
                        height: `${dimensions.height}px`,
                        overflow: 'visible',
                        background: 'white',
                        position: 'relative'
                    }}
                >
                    <LaminaPage
                        product={translatedData?.productImages[product.id]
                            ? { ...product, imageUrl: translatedData.productImages[product.id] }
                            : product}
                        layoutConfig={translatedData ? {
                            ...layoutConfig,
                            sealUrl: translatedData.seal || layoutConfig.sealUrl
                        } : layoutConfig}
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
