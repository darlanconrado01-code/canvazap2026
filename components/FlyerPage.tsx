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
    style?: React.CSSProperties;
    className?: string;
    crossOrigin?: "anonymous" | "use-credentials" | "";
}

export const FlyerPage = forwardRef<HTMLDivElement, FlyerPageProps>(({
    products,
    pageIndex,
    theme,
    layoutConfig,
    companyLogoUrl,
    scale = 1,
    style,
    className,
    crossOrigin
}, ref) => {

    return (
        <div
            ref={ref}
            className={`flyer-page ${className || ''}`}
            style={{
                width: '210mm',
                height: '297mm',
                background: 'white',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                ...style
            }}
        >
            {/* Background Theme */}
            {theme?.backgroundEncartes && (
                <img
                    src={theme.backgroundEncartes}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'stretch', zIndex: 0 }}
                    alt="Background"
                    crossOrigin={crossOrigin}
                />
            )}

            {/* Company Logo */}
            {companyLogoUrl && layoutConfig.logoConfig?.visible && (
                <img
                    src={companyLogoUrl}
                    style={{
                        position: 'absolute',
                        left: `${layoutConfig.logoConfig.x}%`,
                        top: `${layoutConfig.logoConfig.y}px`,
                        width: '150px',
                        transform: `scale(${layoutConfig.logoConfig.scale})`,
                        transformOrigin: 'center',
                        zIndex: 3,
                        pointerEvents: 'none'
                    }}
                    alt="Logo da Empresa"
                    crossOrigin={crossOrigin}
                />
            )}

            {/* Side Text */}
            {layoutConfig.sideTextConfig && layoutConfig.sideTextConfig.visible && (
                <div style={{
                    position: 'absolute',
                    left: `${layoutConfig.sideTextConfig.x}%`,
                    top: `${layoutConfig.sideTextConfig.y}px`,
                    transform: `rotate(${layoutConfig.sideTextConfig.rotation}deg) scale(${layoutConfig.sideTextConfig.scale})`,
                    fontSize: `${layoutConfig.sideTextConfig.fontSize}px`,
                    color: layoutConfig.sideTextConfig.color,
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    zIndex: 2,
                    transformOrigin: 'center'
                }}>
                    {layoutConfig.sideTextConfig.text}
                </div>
            )}

            {/* Grid Content */}
            <div style={{
                position: 'absolute',
                top: layoutConfig.marginTop,
                bottom: layoutConfig.marginBottom,
                left: layoutConfig.marginLeft,
                right: layoutConfig.marginRight,
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: `repeat(${layoutConfig.columns}, 1fr)`,
                gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
                gap: `${layoutConfig.gap}px`
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
                            background: cardBgString,
                            backdropFilter: backdropFilter,
                            borderRadius: `${layoutConfig.cardRadius}px`,
                            padding: `${layoutConfig.cardPadding}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>

                            {/* Product Image Area */}
                            <div style={{
                                flex: 1,
                                width: '100%',
                                marginBottom: `${layoutConfig.spacingBelowPhoto}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                minHeight: 0
                            }}>
                                <div style={{
                                    aspectRatio: '1 / 1',
                                    width: `${layoutConfig.photoScale * 100}%`,
                                    height: 'auto',
                                    maxHeight: '100%',
                                    maxWidth: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    margin: '0 auto'
                                }}>
                                    <SmartImage
                                        urls={product.candidateUrls}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain'
                                        }}
                                        crossOrigin={crossOrigin}
                                        fallback={
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 4 }}>
                                                <ImageIcon size={24} color="#cbd5e1" />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>

                            <div style={{
                                marginBottom: `${layoutConfig.spacingBelowDescription}px`,
                                textAlign: 'center',
                                width: '100%',
                                fontSize: `${layoutConfig.fontSizeDescription}rem`,
                                color: layoutConfig.colorDescription,
                                lineHeight: '1.2',
                                fontWeight: 500,
                            }}>
                                {product.description}
                            </div>

                            {/* Price */}
                            <div style={{
                                marginTop: `${layoutConfig.spacingAbovePrice}px`,
                                color: layoutConfig.colorPrice,
                                fontWeight: 800,
                                fontSize: `${layoutConfig.fontSizePrice}rem`,
                                textAlign: 'center',
                                lineHeight: 1,
                                position: 'relative',
                                display: 'inline-block' // Needed for seal positioning if we were to put it relative to text
                            }}>
                                {product.price}
                                {/* Price Seal (Badge) */}
                                {layoutConfig.showPriceSeal && theme?.priceSealUrl && (
                                    <img
                                        src={theme.priceSealUrl}
                                        style={{
                                            position: 'absolute',
                                            top: '-80%',
                                            right: '-80%',
                                            height: '250%',
                                            width: 'auto',
                                            pointerEvents: 'none',
                                            zIndex: -1,
                                            opacity: 1
                                        }}
                                        alt="Selo de Preço"
                                        crossOrigin={crossOrigin}
                                    />
                                )}
                            </div>

                            {/* Codes */}
                            <div style={{ marginTop: '4px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                {layoutConfig.showInternalCode && product.internalCode && (
                                    <div style={{ fontSize: `${layoutConfig.fontInternalCode}rem`, color: layoutConfig.colorInternalCode }}>
                                        Cód: {product.internalCode}
                                    </div>
                                )}
                                {layoutConfig.showEan && product.ean && (
                                    <div style={{ fontSize: `${layoutConfig.fontEan}rem`, color: layoutConfig.colorEan }}>
                                        EAN: {product.ean}
                                    </div>
                                )}
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
});

FlyerPage.displayName = 'FlyerPage';
