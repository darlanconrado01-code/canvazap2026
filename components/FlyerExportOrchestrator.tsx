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

    // Helper to wait for images
    const waitForImages = async (element: HTMLElement) => {
        const images = Array.from(element.querySelectorAll('img'));
        const promises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if error
            });
        });
        // Add a safety timeout buffer
        await Promise.all([
            ...promises,
            new Promise(resolve => setTimeout(resolve, 1500)) // Wait 1.5s for safety
        ]);
    };

    const getPageElement = (index: number): HTMLElement | null => {
        if (!containerRef.current) return null;
        return containerRef.current.querySelector(`[data-export-page="${index}"]`) as HTMLElement;
    };

    const generateCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        // Scroll to top to avoid offset issues
        window.scrollTo(0, 0);
        await waitForImages(element);

        return await html2canvas(element, {
            scale: 3, // Even higher resolution
            useCORS: true,
            allowTaint: false, // Don't allow tainted canvas (it breaks toBlob)
            backgroundColor: '#ffffff',
            logging: false,
            width: 794, // Standard A4 width at 96 DPI
            height: 1123, // Standard A4 height at 96 DPI
            windowWidth: 1200,
            windowHeight: 1600
        });
    };

    useImperativeHandle(ref, () => ({
        exportCurrentPageJpg: async (pageIndex) => {
            if (onExportStart) onExportStart();
            try {
                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

                const canvas = await generateCanvas(el);
                canvas.toBlob(blob => {
                    if (blob) saveAs(blob, `encarte-pag-${pageIndex + 1}.jpg`);
                }, 'image/jpeg', 0.9);
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar JPG.');
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllPagesJpgZip: async () => {
            if (onExportStart) onExportStart();
            try {
                const zip = new JSZip();
                for (let i = 0; i < pages.length; i++) {
                    const el = getPageElement(i);
                    if (el) {
                        const canvas = await generateCanvas(el);
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                        if (blob) zip.file(`encarte-pag-${i + 1}.jpg`, blob);
                    }
                }
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, 'encarte-completo.zip');
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar ZIP.');
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportCurrentPagePdf: async (pageIndex) => {
            if (onExportStart) onExportStart();
            try {
                const el = getPageElement(pageIndex);
                if (!el) throw new Error("Página não encontrada");

                const canvas = await generateCanvas(el);
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                pdf.save(`encarte-pag-${pageIndex + 1}.pdf`);
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar PDF.');
            } finally {
                if (onExportEnd) onExportEnd();
            }
        },
        exportAllPagesPdf: async () => {
            if (onExportStart) onExportStart();
            try {
                const pdf = new jsPDF('p', 'mm', 'a4');
                for (let i = 0; i < pages.length; i++) {
                    const el = getPageElement(i);
                    if (el) {
                        if (i > 0) pdf.addPage();
                        const canvas = await generateCanvas(el);
                        const imgData = canvas.toDataURL('image/jpeg', 0.9);
                        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                    }
                }
                pdf.save('encarte-completo.pdf');
            } catch (error) {
                console.error(error);
                alert('Erro ao exportar PDF.');
            } finally {
                if (onExportEnd) onExportEnd();
            }
        }
    }));

    const proxyUrl = (url: string | null | undefined) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
        // Using a reliable public proxy
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: -9999,
                opacity: 0,
                pointerEvents: 'none',
                width: '210mm',
                height: '297mm'
            }}
        >
            {pages.map((pageProducts, i) => {
                // Map products to use proxied image URLs
                const proxiedProducts = pageProducts.map(p => ({
                    ...p,
                    candidateUrls: p.candidateUrls.map(url => proxyUrl(url) as string)
                }));

                // Map theme to use proxied URLs
                const proxiedTheme = theme ? {
                    ...theme,
                    backgroundEncartes: proxyUrl(theme.backgroundEncartes) || '',
                    priceSealUrl: proxyUrl(theme.priceSealUrl) || ''
                } : null;

                const proxiedLogo = proxyUrl(companyLogoUrl);

                return (
                    <div key={i} data-export-page={i}>
                        <FlyerPage
                            products={proxiedProducts}
                            pageIndex={i}
                            theme={proxiedTheme}
                            layoutConfig={layoutConfig}
                            companyLogoUrl={proxiedLogo}
                            scale={1}
                            style={{ background: '#ffffff', width: '210mm', height: '297mm' }}
                            className="flyer-page-export"
                            crossOrigin="anonymous"
                        />
                    </div>
                );
            })}
        </div>
    );
});

FlyerExportOrchestrator.displayName = 'FlyerExportOrchestrator';
