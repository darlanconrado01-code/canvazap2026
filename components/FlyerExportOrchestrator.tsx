import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Theme, ProductItem, LayoutConfig } from './FlyerTypes';
import { FlyerPage } from './FlyerPage';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface FlyerExportOrchestratorRef {
    exportCurrentPageJpg: (pageIndex: number) => Promise<void>;
    exportAllPagesJpgZip: () => Promise<void>;
    exportCurrentPagePdf: (pageIndex: number) => Promise<void>;
    exportAllPagesPdf: () => Promise<void>;
    generateImages: (pageIndex?: number) => Promise<Blob[]>;
}

interface FlyerExportOrchestratorProps {
    pages: ProductItem[][];
    theme: Theme | null;
    layoutConfig: LayoutConfig;
    companyLogoUrl: string | null;
    onExportStart?: () => void;
    onExportEnd?: () => void;
    onProgress?: (message: string) => void;
}

export const FlyerExportOrchestrator = forwardRef<FlyerExportOrchestratorRef, FlyerExportOrchestratorProps>(({
    pages,
    theme,
    layoutConfig,
    companyLogoUrl,
    onExportStart,
    onExportEnd,
    onProgress
}, ref) => {
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

    const getPageElement = (index: number): HTMLElement | null => {
        if (!containerRef.current) return null;
        return containerRef.current.querySelector(`[data-export-page="${index}"]`) as HTMLElement;
    };

    // --- O INTERMEDIADOR (TRADUTOR DE IMAGENS) ---
    const intermediador = async (url: string | null | undefined, forceSquare: boolean = false): Promise<string> => {
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

                    if (forceSquare) {
                        // TÉCNICA SUPREMA: Criamos uma imagem quadrada TRANSPARENTE e colocamos o produto no meio.
                        const size = Math.max(img.width, img.height);
                        canvas.width = size;
                        canvas.height = size;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            // Fundo transparente (padrão do canvas, mas garantindo que não estamos limpando com branco)
                            const x = (size - img.width) / 2;
                            const y = (size - img.height) / 2;
                            ctx.drawImage(img, x, y);
                            resolve(canvas.toDataURL('image/png'));
                        } else {
                            resolve(proxyUrl);
                        }
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } else {
                            resolve(proxyUrl);
                        }
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

    const generateCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        await waitForImages(element);

        // ESPERA POR FONTES - Crucial para evitar texto cortado por atraso de renderização
        await document.fonts.ready;

        // Assentar layout (2 frames)
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        return await html2canvas(element, {
            scale: 1, // 1:1 com o render nativo de Camada 2
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            logging: false,
            width: 1588,
            height: 2246,
            windowWidth: 1588,
            windowHeight: 2246,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, el) => {
                const clonedEl = el as HTMLElement;

                clonedDoc.documentElement.style.width = '1588px';
                clonedDoc.documentElement.style.height = '2246px';
                clonedDoc.body.style.width = '1588px';
                clonedDoc.body.style.height = '2246px';

                clonedEl.style.opacity = '1';
                clonedEl.style.visibility = 'visible';
                clonedEl.style.transform = 'none';
                clonedEl.style.left = '0';
                clonedEl.style.top = '0';
                clonedEl.style.width = '1588px';
                clonedEl.style.height = '2246px';

                // Fonte / suavização
                const body = clonedDoc.body;
                body.style.fontSize = '16px';
                (body.style as any).webkitFontSmoothing = 'antialiased';
                (body.style as any).mozOsxFontSmoothing = 'grayscale';
                // body.style.textRendering = 'geometricPrecision'; // Removido global conforme solicitado
                (body.style as any).webkitTextSizeAdjust = '100%';

                // Targeted Anti-clipping
                const root = clonedEl; // Targeted specifically at the page we are capturing

                // Hide all other pages in the clone to prevent layout interference
                const allPages = clonedDoc.querySelectorAll('[data-export-page]');
                allPages.forEach((p: any) => {
                    const pageAttr = p.getAttribute('data-export-page');
                    const currentAttr = clonedEl.getAttribute('data-export-page');
                    if (pageAttr !== currentAttr) {
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
        background: string;
        seal: string;
        productImages: Record<string, string>;
    } | null>(null);

    useImperativeHandle(ref, () => ({
        exportCurrentPageJpg: async (pageIndex) => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciamos o download do seu encarte...");
            try {
                // ETAPA DE INTERMEDIAÇÃO (TRADUÇÃO)
                if (onProgress) onProgress("Preparando imagens e fundos...");
                const [logoB64, bgB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(theme?.backgroundEncartes),
                    intermediador(theme?.priceSealUrl)
                ]);

                const productImages: Record<string, string> = {};
                const pageProducts = pages[pageIndex] || [];
                const productPromises = pageProducts.map(async p => {
                    const src = p.imageUrl || p.candidateUrls[0];
                    if (src) productImages[p.id] = await intermediador(src, true);
                });
                await Promise.all(productPromises);

                setTranslatedData({ logo: logoB64, background: bgB64, seal: sealB64, productImages });
                if (onProgress) onProgress("Não se preocupe! Estamos renderizando seu encarte...");

                // Aumentamos para 2s para garantir render completa das Base64 e do Background
                await new Promise(r => setTimeout(r, 2000));

                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

                if (onProgress) onProgress("Finalizando arquivo JPG...");
                const canvas = await generateCanvas(el);
                canvas.toBlob(blob => {
                    if (blob) saveAs(blob, `encarte-pag-${pageIndex + 1}.jpg`);
                    setTranslatedData(null);
                }, 'image/jpeg', 0.95);
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar JPG.');
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllPagesJpgZip: async () => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciamos a geração do pacote de encartes...");
            try {
                const zip = new JSZip();

                if (onProgress) onProgress("Processando assets globais...");
                const [logoB64, bgB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(theme?.backgroundEncartes),
                    intermediador(theme?.priceSealUrl)
                ]);

                // Para o ZIP, traduzimos TODOS os produtos de uma vez para ganhar performance
                const allProductImages: Record<string, string> = {};
                const allProductPromises = pages.flat().map(async p => {
                    const src = p.imageUrl || p.candidateUrls[0];
                    if (src && !allProductImages[p.id]) {
                        allProductImages[p.id] = await intermediador(src, true);
                    }
                });
                await Promise.all(allProductPromises);

                for (let i = 0; i < pages.length; i++) {
                    if (onProgress) onProgress(`Processando página ${i + 1} de ${pages.length}...`);
                    setTranslatedData({
                        logo: logoB64,
                        background: bgB64,
                        seal: sealB64,
                        productImages: allProductImages
                    });

                    // Esperar renderização de cada página
                    await new Promise(r => setTimeout(r, 1500));

                    const el = getPageElement(i);
                    if (el) {
                        const canvas = await generateCanvas(el);
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                        if (blob) zip.file(`encarte-pag-${i + 1}.jpg`, blob);
                    }
                }
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, 'encarte-completo.zip');
                setTranslatedData(null);
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar ZIP.');
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportCurrentPagePdf: async (pageIndex) => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciamos a geração do seu PDF...");
            try {
                if (onProgress) onProgress("Preparando componentes visuais...");
                const [logoB64, bgB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(theme?.backgroundEncartes),
                    intermediador(theme?.priceSealUrl)
                ]);

                const productImages: Record<string, string> = {};
                const pageProducts = pages[pageIndex] || [];
                const productPromises = pageProducts.map(async p => {
                    const src = p.imageUrl || p.candidateUrls[0];
                    if (src) productImages[p.id] = await intermediador(src, true);
                });
                await Promise.all(productPromises);

                setTranslatedData({ logo: logoB64, background: bgB64, seal: sealB64, productImages });
                if (onProgress) onProgress("Aguarde um instante, estamos montando a página...");
                await new Promise(r => setTimeout(r, 2000));

                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

                if (onProgress) onProgress("Gerando PDF de alta qualidade...");
                const canvas = await generateCanvas(el);
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                pdf.save(`encarte-pag-${pageIndex + 1}.pdf`);
                setTranslatedData(null);
            } catch (error) {
                console.error(error);
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllPagesPdf: async () => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciamos a geração do PDF completo...");
            try {
                const pdf = new jsPDF('p', 'mm', 'a4');
                if (onProgress) onProgress("Preparando assets para múltiplas páginas...");
                const [logoB64, bgB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(theme?.backgroundEncartes),
                    intermediador(theme?.priceSealUrl)
                ]);

                // Traduzir todos os produtos
                const allProductImages: Record<string, string> = {};
                const allProductPromises = pages.flat().map(async p => {
                    const src = p.imageUrl || p.candidateUrls[0];
                    if (src && !allProductImages[p.id]) {
                        allProductImages[p.id] = await intermediador(src, true);
                    }
                });
                await Promise.all(allProductPromises);

                for (let i = 0; i < pages.length; i++) {
                    if (onProgress) onProgress(`Renderizando página ${i + 1} de ${pages.length}...`);
                    setTranslatedData({
                        logo: logoB64,
                        background: bgB64,
                        seal: sealB64,
                        productImages: allProductImages
                    });

                    await new Promise(r => setTimeout(r, 1500));

                    const el = getPageElement(i);
                    if (el) {
                        if (i > 0) pdf.addPage();
                        const canvas = await generateCanvas(el);
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                    }
                }
                pdf.save('encarte-completo.pdf');
                setTranslatedData(null);
            } catch (error) {
                console.error(error);
                setTranslatedData(null);
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        generateImages: async (pageIndex?: number): Promise<Blob[]> => {
            if (onExportStart) onExportStart();
            if (onProgress) onProgress("Iniciamos o processamento para WhatsApp...");
            const blobs: Blob[] = [];
            try {
                // 1. Initial translations
                if (onProgress) onProgress("Traduzindo elementos gráficos...");
                const [logoB64, bgB64, sealB64] = await Promise.all([
                    intermediador(companyLogoUrl),
                    intermediador(theme?.backgroundEncartes),
                    intermediador(theme?.priceSealUrl)
                ]);

                // 2. Batch product translations to avoid browser request limits
                const allProductImages: Record<string, string> = {};
                const flatProducts = pages.flat();
                const CHUNK_SIZE = 5;

                for (let i = 0; i < flatProducts.length; i += CHUNK_SIZE) {
                    const chunk = flatProducts.slice(i, i + CHUNK_SIZE);
                    const currentBatch = i / CHUNK_SIZE + 1;
                    const totalBatches = Math.ceil(flatProducts.length / CHUNK_SIZE);

                    if (onProgress) onProgress(`Processando imagens dos produtos (${currentBatch}/${totalBatches})...`);
                    console.log(`[Export] Traduzindo lote de produtos ${currentBatch}...`);
                    await Promise.all(chunk.map(async p => {
                        const src = p.imageUrl || p.candidateUrls[0];
                        if (src && !allProductImages[p.id]) {
                            allProductImages[p.id] = await intermediador(src, true);
                        }
                    }));
                }

                // 3. Set data ONCE for all pages
                setTranslatedData({
                    logo: logoB64,
                    background: bgB64,
                    seal: sealB64,
                    productImages: allProductImages
                });

                if (onProgress) onProgress("Não se preocupe! Estamos trabalhando em seu encarte...");

                // Wait for the DOM to update and images to render
                await new Promise(r => setTimeout(r, 2000));

                // 4. Generate page(s)
                const pagesToProcess = pageIndex !== undefined ? [pageIndex] : pages.map((_, idx) => idx);

                for (const i of pagesToProcess) {
                    if (onProgress) onProgress(`Finalizando lâmina ${i + 1} de ${pagesToProcess.length}...`);
                    console.log(`[Export] Processando página ${i + 1}/${pages.length}...`);
                    const el = getPageElement(i);
                    if (el) {
                        const canvas = await generateCanvas(el);
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                        if (blob) blobs.push(blob);
                    }
                }

                setTranslatedData(null);
                return blobs;
            } catch (error) {
                console.error("Error generating images:", error);
                setTranslatedData(null);
                throw error;
            } finally {
                if (onExportEnd) onExportEnd();
            }
        }
    }));

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: '-9999px',
                zIndex: -9999,
                width: '4000px', // Container gigante (Camada 2)
                height: '4000px',
                background: 'white'
            }}
        >
            {pages.map((pageProducts, i) => (
                <div key={i} data-export-page={i} data-export-root="true" style={{ width: '1588px', height: '2246px', overflow: 'visible', background: 'white' }}>
                    <FlyerPage
                        products={pageProducts.map(p => translatedData?.productImages[p.id] ? { ...p, candidateUrls: [translatedData.productImages[p.id]] } : p)}
                        pageIndex={i}
                        theme={theme ? {
                            ...theme,
                            backgroundEncartes: translatedData?.background || theme.backgroundEncartes,
                            priceSealUrl: translatedData?.seal || theme.priceSealUrl
                        } : null}
                        layoutConfig={layoutConfig}
                        companyLogoUrl={translatedData?.logo || companyLogoUrl}
                        scale={2} // CAMADA 2: ESCALA NATIVA 2X
                        isExport={true}
                        style={{ width: '100%', height: '100%' }}
                        crossOrigin="anonymous"
                    />
                </div>
            ))}
        </div>
    );
});

FlyerExportOrchestrator.displayName = 'FlyerExportOrchestrator';
