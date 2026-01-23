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
}

interface FlyerExportOrchestratorProps {
    pages: ProductItem[][];
    theme: Theme | null;
    layoutConfig: LayoutConfig;
    companyLogoUrl: string | null;
    onExportStart?: () => void;
    onExportEnd?: () => void;
}

export const FlyerExportOrchestrator = forwardRef<FlyerExportOrchestratorRef, FlyerExportOrchestratorProps>(({
    pages,
    theme,
    layoutConfig,
    companyLogoUrl,
    onExportStart,
    onExportEnd
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
            // Adicionamos parâmetros para garantir que o weserv não remova a transparência e converta para PNG se necessário
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&n=-1&output=png`;

            img.crossOrigin = "anonymous";
            img.onload = () => {
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
            img.onerror = () => resolve(url);
            img.src = proxyUrl;
        });
    };

    const generateCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        await waitForImages(element);

        return await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: null, // Transparent background for the canvas itself
            logging: false,
            width: 794,
            height: 1123,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc, el) => {
                const clonedEl = el as HTMLElement;
                clonedEl.style.opacity = '1';
                clonedEl.style.visibility = 'visible';
                clonedEl.style.transform = 'none';
                clonedEl.style.left = '0';
                clonedEl.style.top = '0';
                clonedEl.style.display = 'flex'; // FlyerPage uses flex sometimes, and grid

                // Hack: html2canvas as vezes falha com backdrop-filter, vamos tentar reforçar as cores
                const cards = clonedEl.querySelectorAll('[style*="backdrop-filter"]');
                cards.forEach((card: any) => {
                    // Se estiver usando glassmorphism, aumentamos um pouco a opacidade para compensar a falta do blur no export
                    if (card.style.backdropFilter !== 'none') {
                        card.style.backgroundColor = card.style.backgroundColor.replace(/[\d.]+\)$/, '0.92)');
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
            try {
                // ETAPA DE INTERMEDIAÇÃO (TRADUÇÃO)
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

                // Aumentamos para 2s para garantir render completa das Base64 e do Background
                await new Promise(r => setTimeout(r, 2000));

                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

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
            try {
                const zip = new JSZip();

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
            try {
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
                await new Promise(r => setTimeout(r, 2000));

                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

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
            try {
                const pdf = new jsPDF('p', 'mm', 'a4');
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
                width: '794px',
                height: '1123px',
                background: 'white'
            }}
        >
            {pages.map((pageProducts, i) => (
                <div key={i} data-export-page={i} style={{ width: '794px', height: '1123px', overflow: 'hidden' }}>
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
                        scale={1}
                        style={{ width: '100%', height: '100%' }}
                        crossOrigin="anonymous"
                    />
                </div>
            ))}
        </div>
    );
});

FlyerExportOrchestrator.displayName = 'FlyerExportOrchestrator';
