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
                <img
                    src={companyLogoUrl}
                    style={{
                        position: 'absolute',
                        left: `${layoutConfig.logoConfig.x}%`,
                        top: `${layoutConfig.logoConfig.y}px`,
                        width: 'auto',
                        maxHeight: '120px',
                        transform: `scale(${layoutConfig.logoConfig.scale})`,
                        transformOrigin: 'center',
                        zIndex: 50,
                        pointerEvents: 'none'
                    }}
                    alt="Logo da Empresa"
                    crossOrigin={companyLogoUrl.startsWith('data:') ? undefined : crossOrigin}
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
                    zIndex: 40,
                    transformOrigin: 'center'
                }}>
                    {layoutConfig.sideTextConfig.text}
                </div>
            )}

            {/* Grid Content */}
            <div style={{
                position: 'absolute',
                top: `${layoutConfig.marginTop}px`,
                bottom: `${layoutConfig.marginBottom}px`,
                left: `${layoutConfig.marginLeft}px`,
                right: `${layoutConfig.marginRight}px`,
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
                            boxShadow: layoutConfig.cardBackgroundMode !== 'none' ? '0 4px 15px rgba(0,0,0,0.12)' : 'none',
                            padding: `${layoutConfig.cardPadding}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>

                            <div style={{
                                width: '100%',
                                marginBottom: `${layoutConfig.spacingBelowPhoto}px`,
                                position: 'relative',
                                // Este é o hack definitivo para manter proporção 1:1 independente do conteúdo
                                height: 0,
                                paddingBottom: '100%',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: `${(1 - layoutConfig.photoScale) * 50}%`,
                                    left: `${(1 - layoutConfig.photoScale) * 50}%`,
                                    width: `${layoutConfig.photoScale * 100}%`,
                                    height: `${layoutConfig.photoScale * 100}%`,
                                }}>
                                    <SmartImage
                                        urls={product.candidateUrls}
                                        style={{
                                            width: '100%',
                                            height: '100%',
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

                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {(layoutConfig.elementsOrder || ['code', 'description', 'price']).map(element => {
                                    if (element === 'code') {
                                        return (
                                            <div key="codes" style={{
                                                marginBottom: '4px',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '2px'
                                            }}>
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
                                        );
                                    }
                                    if (element === 'description') {
                                        return (
                                            <div key="desc" style={{
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
                                        );
                                    }
                                    if (element === 'price' && product.price) {
                                        return (
                                            <div key="price" style={{
                                                marginTop: `${layoutConfig.spacingAbovePrice}px`,
                                                color: layoutConfig.colorPrice,
                                                fontWeight: 800,
                                                fontSize: `${layoutConfig.fontSizePrice}rem`,
                                                textAlign: 'center',
                                                lineHeight: 1,
                                                position: 'relative',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px 12px'
                                            }}>
                                                <span style={{ position: 'relative', zIndex: 2 }}>{product.price}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
});

FlyerPage.displayName = 'FlyerPage';
