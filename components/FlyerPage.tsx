import React, { forwardRef } from 'react';
import { Theme, ProductItem, LayoutConfig } from './FlyerTypes';
import { SmartImage } from './SmartImage';
import { AlertCircle, AlertTriangle, ImageIcon } from 'lucide-react';

interface FlyerPageProps {
    products: ProductItem[];
    pageIndex: number;
    theme: Theme | null;
    layoutConfig: LayoutConfig;
    companyLogoUrl: string | null;
    scale?: number;
    isExport?: boolean;
    style?: React.CSSProperties;
    className?: string;
    crossOrigin?: "anonymous" | "use-credentials" | "";
    onLogoClick?: () => void;
}

export const FlyerPage = forwardRef<HTMLDivElement, FlyerPageProps>(({
    products,
    pageIndex,
    theme,
    layoutConfig,
    companyLogoUrl,
    scale = 1,
    isExport = false,
    style,
    className,
    crossOrigin,
    onLogoClick
}, ref) => {

    const BASE_W = 794;
    const BASE_H = 1123;
    const INT_SCALE = 2; // Camada 2 base resolution
    const PAGE_H = BASE_H * INT_SCALE; // 2246
    const PAGE_W = BASE_W * INT_SCALE; // 1588

    const displayScale = isExport ? 1 : scale;
    const contentScale = INT_SCALE;
    const finalScale = contentScale; // Layout math should ONLY use page scale

    // Helper to scale values (Cumulative)
    const s = (val: number | undefined) => Math.round((val || 0) * finalScale);
    const spx = (val: number | undefined) => `${Math.round((val || 0) * finalScale)}px`;
    const srem = (val: number | undefined) => `${Math.round((val || 0) * 16 * finalScale)}px`;

    // Specific scale for elements NOT affected by cardScale (Logo, Top Text)
    const spx_page = (val: number | undefined) => `${Math.round((val || 0) * contentScale)}px`;

    return (
        <div
            className="flyer-page-preview-container"
            style={{
                width: isExport ? `${PAGE_W}px` : `${PAGE_W * displayScale}px`,
                height: isExport ? `${PAGE_H}px` : `${PAGE_H * displayScale}px`,
                position: 'relative',
                flexShrink: 0,
                ...style
            }}
        >
            <div
                ref={ref}
                className={`flyer-page ${className || ''}`}
                style={{
                    width: `${PAGE_W}px`,
                    height: `${PAGE_H}px`,
                    background: 'white',
                    position: 'absolute',
                    top: 0,
                    left: isExport ? 0 : '50%',
                    transform: isExport ? 'none' : `translateX(-50%) scale(${displayScale})`,
                    transformOrigin: 'top center',
                    overflow: 'hidden',
                }}
            >
                {/* Background Theme */}
                {theme?.backgroundEncartes && (
                    <img
                        src={theme.backgroundEncartes}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 0
                        }}
                        alt="Background"
                        crossOrigin={theme.backgroundEncartes.startsWith('data:') ? undefined : crossOrigin}
                    />
                )}

                {/* Company Logo */}
                {companyLogoUrl && layoutConfig.logoConfig?.visible && (
                    <div
                        className="company-logo-container"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.logoConfig.x}%`,
                            top: spx_page(layoutConfig.logoConfig.y),
                            transform: `translateX(-50%) scale(${layoutConfig.logoConfig.scale})`,
                            transformOrigin: 'top center',
                            zIndex: 50,
                        }}
                    >
                        <img
                            src={companyLogoUrl}
                            style={{
                                width: 'auto',
                                maxHeight: spx_page(120),
                                display: 'block'
                            }}
                            alt="Logo da Empresa"
                            crossOrigin={companyLogoUrl.startsWith('data:') ? undefined : crossOrigin}
                        />

                        {onLogoClick && (
                            <button
                                data-html2canvas-ignore="true"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onLogoClick();
                                }}
                                style={{
                                    position: 'absolute',
                                    bottom: '-8px',
                                    right: '-8px',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: '2px solid white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    pointerEvents: 'auto',
                                    transition: 'all 0.2s',
                                    zIndex: 60
                                }}
                                className="logo-switcher-trigger"
                                title="Trocar Logomarca (Clique aqui)"
                            >
                                <ImageIcon size={14} />
                            </button>
                        )}
                    </div>
                )}

                {/* Side Text */}
                {layoutConfig.sideTextConfig && layoutConfig.sideTextConfig.visible && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.sideTextConfig.x}%`,
                            top: spx_page(layoutConfig.sideTextConfig.y),
                            transform: `rotate(${layoutConfig.sideTextConfig.rotation}deg) scale(${layoutConfig.sideTextConfig.scale})`,
                            fontSize: spx_page(layoutConfig.sideTextConfig.fontSize),
                            color: layoutConfig.sideTextConfig.color,
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            zIndex: 40,
                            transformOrigin: 'center'
                        }}
                    >
                        {layoutConfig.sideTextConfig.text}
                    </div>
                )}

                {/* Promo Month Layer */}
                {layoutConfig.promoMonth && layoutConfig.promoMonth.visible && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.promoMonth.x}%`,
                            top: spx_page(layoutConfig.promoMonth.y),
                            transform: 'translateX(-50%)',
                            fontSize: spx_page(layoutConfig.promoMonth.fontSize),
                            color: layoutConfig.promoMonth.color,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: spx_page(2),
                            zIndex: 45,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {layoutConfig.promoMonth.text}
                    </div>
                )}

                {/* Promo Badge / Day Layer */}
                {layoutConfig.promoBadge && layoutConfig.promoBadge.visible && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.promoBadge.x}%`,
                            top: spx_page(layoutConfig.promoBadge.y),
                            transform: `translateX(-50%) scale(${layoutConfig.promoBadge.scale})`,
                            fontSize: spx_page(layoutConfig.promoBadge.fontSize),
                            color: layoutConfig.promoBadge.color,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            zIndex: 55,
                            whiteSpace: 'nowrap',
                            textShadow: `0 ${spx_page(2)} ${spx_page(4)} rgba(0,0,0,0.1)`
                        }}
                    >
                        {layoutConfig.promoBadge.text}
                    </div>
                )}

                {/* Grid Content */}
                <div style={{
                    position: 'absolute',
                    top: spx(layoutConfig.marginTop),
                    bottom: spx(layoutConfig.marginBottom),
                    left: spx(layoutConfig.marginLeft),
                    right: spx(layoutConfig.marginRight),
                    zIndex: 1,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layoutConfig.columns}, 1fr)`,
                    gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
                    columnGap: spx(layoutConfig.gap),
                    rowGap: spx(layoutConfig.rowGap || layoutConfig.gap)
                }}>
                    {products.map((product) => {
                        // Card Style Logic
                        let cardBgString = 'transparent';
                        let backdropFilter = 'none';

                        if (layoutConfig.cardBackgroundMode === 'white') {
                            cardBgString = `rgba(255,255,255, ${layoutConfig.cardOpacity})`;
                        } else if (layoutConfig.cardBackgroundMode === 'glass') {
                            cardBgString = `rgba(255,255,255, ${layoutConfig.cardOpacity})`;
                            backdropFilter = 'blur(10px)';
                        }

                        return (
                            <div key={product.id} style={{
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    background: cardBgString,
                                    backdropFilter: backdropFilter,
                                    borderRadius: spx(layoutConfig.cardRadius),
                                    boxShadow: layoutConfig.cardBackgroundMode !== 'none' ? `0 ${spx(4)} ${spx(15)} rgba(0,0,0,0.12)` : 'none',
                                    padding: spx(layoutConfig.cardPadding),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxSizing: 'border-box',
                                    transform: `scale(${layoutConfig.cardScale || 1})`,
                                    transformOrigin: 'center',
                                    position: 'relative'
                                }}>

                                    {/* Área da Foto - Proporção Ajustável */}
                                    <div style={{
                                        width: '100%',
                                        marginBottom: spx(layoutConfig.spacingBelowPhoto),
                                        position: 'relative',
                                        height: 0,
                                        paddingBottom: `${layoutConfig.photoAreaHeight || 70}%`,
                                        flexShrink: 0
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: `${(1 - layoutConfig.photoScale) * 50}%`,
                                            left: `${(1 - layoutConfig.photoScale) * 50}%`,
                                            width: `${layoutConfig.photoScale * 100}%`,
                                            height: `${layoutConfig.photoScale * 100}%`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <SmartImage
                                                urls={product.candidateUrls}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                }}
                                                crossOrigin={crossOrigin}
                                                fallback={
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: s(4) }}>
                                                        <ImageIcon size={s(48)} color="#cbd5e1" />
                                                    </div>
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        flexGrow: 1,
                                        paddingBottom: product.price ? spx(layoutConfig.fontSizePrice * 1.5 + 20) : 0, // reserva para preço absoluto
                                        justifyContent: 'flex-start'
                                    }}>
                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            {(layoutConfig.elementsOrder || ['code', 'description', 'price']).filter(e => e !== 'price').map(element => {
                                                if (element === 'code') {
                                                    return (
                                                        <div
                                                            key="codes"
                                                            data-export-text="true"
                                                            style={{
                                                                marginBottom: spx(4),
                                                                textAlign: 'center',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                gap: spx(2)
                                                            }}
                                                        >
                                                            {layoutConfig.showInternalCode && product.internalCode && (
                                                                <div style={{ fontSize: srem(layoutConfig.fontInternalCode), color: layoutConfig.colorInternalCode }}>
                                                                    Cód: {product.internalCode}
                                                                </div>
                                                            )}
                                                            {layoutConfig.showEan && product.ean && (
                                                                <div style={{ fontSize: srem(layoutConfig.fontEan), color: layoutConfig.colorEan }}>
                                                                    EAN: {product.ean}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                const fontPx = layoutConfig.fontSizeDescription * 16 * finalScale;
                                                if (element === 'description') {
                                                    return (
                                                        <div
                                                            key="desc"
                                                            data-export-text="true"
                                                            style={{
                                                                marginBottom: spx(layoutConfig.spacingBelowDescription),
                                                                textAlign: 'center',
                                                                width: '100%',
                                                                fontSize: (() => {
                                                                    const text = product.normalizedDescription || product.description || '';
                                                                    if (text.length > 50) return `${Math.round(fontPx * 0.7)}px`;
                                                                    if (text.length > 35) return `${Math.round(fontPx * 0.82)}px`;
                                                                    if (text.length > 20) return `${Math.round(fontPx * 0.92)}px`;
                                                                    return `${fontPx}px`;
                                                                })(),
                                                                lineHeight: '1.1',
                                                                fontWeight: 800,
                                                                display: 'block',
                                                                overflow: 'visible',
                                                                wordBreak: 'break-word',
                                                                paddingBottom: `${Math.round(3 * finalScale)}px`
                                                            }}
                                                        >
                                                            {product.normalizedDescription || product.description}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>
                                        {product.price && (
                                            <div
                                                key="price"
                                                data-export-text="true"
                                                style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    bottom: spx(10),
                                                    transform: 'translateX(-50%)',
                                                    color: layoutConfig.colorPrice,
                                                    fontWeight: 950,
                                                    fontSize: srem(layoutConfig.fontSizePrice),
                                                    lineHeight: `${Math.round(layoutConfig.fontSizePrice * 16 * finalScale)}px`,
                                                    textAlign: 'center',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: `${spx(4)} ${spx(12)}`,
                                                    whiteSpace: 'nowrap',
                                                    zIndex: 2
                                                }}
                                            >
                                                <span>{product.price}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

FlyerPage.displayName = 'FlyerPage';
