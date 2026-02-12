import React, { forwardRef } from 'react';
import { ProductItem } from './FlyerTypes';

interface LayoutConfig {
    [key: string]: any;
}

interface LaminaPageProps {
    product: ProductItem;
    layoutConfig: LayoutConfig;
    companyLogoUrl: string | null;
    selectedFormat: 'feed' | 'post' | 'stories' | 'tv';
    scale?: number;
    isExport?: boolean;
    style?: React.CSSProperties;
    className?: string;
    crossOrigin?: "anonymous" | "use-credentials" | "";
}

export const LaminaPage = forwardRef<HTMLDivElement, LaminaPageProps>((
    {
        product,
        layoutConfig,
        companyLogoUrl,
        selectedFormat,
        scale = 1,
        isExport = false,
        style,
        className,
        crossOrigin
    },
    ref
) => {
    // Dimensões baseadas no formato - COPIADO DO FLYERPAGE
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

    const dimensions = getDimensions();
    const PAGE_W = dimensions.width;
    const PAGE_H = dimensions.height;

    // COPIADO DO FLYERPAGE - Escala de display
    const displayScale = isExport ? 1 : scale;
    const contentScale = 1; // Para lâminas, não precisamos de INT_SCALE como nos encartes

    // COPIADO DO FLYERPAGE - Helper para escalar valores
    const s = (val: number | undefined) => Math.round((val || 0) * contentScale);
    const spx = (val: number | undefined) => `${Math.round((val || 0) * contentScale)}px`;

    // Helper para formatar preço
    const formatPrice = (price: string) => {
        const match = price.match(/R?\$?\s*(\d+)[,.](\d{2})/);
        if (!match) return null;
        return { int: match[1], cents: match[2] };
    };

    return (
        <div
            className="lamina-page-preview-container"
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
                className={`lamina-page ${className || ''}`}
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
                {/* Gradiente TV (se aplicável) - ANTES da imagem do produto */}
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

                {/* Imagem do Produto como Fundo - COPIADO DA LÓGICA DO PREVIEW */}
                {product.isLinked && product.imageUrl && (
                    <img
                        src={product.imageUrl}
                        style={{
                            width: `${(layoutConfig.productScale || 1) * 100}%`,
                            height: `${(layoutConfig.productScale || 1) * 100}%`,
                            objectFit: 'cover',
                            transform: `translate(-50%, calc(-50% + ${layoutConfig.yOffset || 0}px))`,
                            position: 'absolute',
                            left: selectedFormat === 'tv' && layoutConfig.tvGradientVisible
                                ? `${(layoutConfig.tvGradientDirection === 'right' ? 30 : 70) + ((layoutConfig.productX || 50) - 50)}%`
                                : `${layoutConfig.productX || 50}%`,
                            top: `${layoutConfig.productY || 50}%`,
                            zIndex: 0
                        }}
                        crossOrigin={crossOrigin}
                        alt="Produto"
                    />
                )}

                {/* Company Logo - COPIADO DO FLYERPAGE */}
                {companyLogoUrl && layoutConfig.logoVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.logoX ?? 50}%`,
                            top: `${layoutConfig.logoY ?? 14}%`,
                            transform: `translate(-50%, -50%) scale(${(layoutConfig.logoScale || 0.24) * 8})`,
                            zIndex: (layoutConfig.layersOrder?.indexOf('logo') ?? 3) + 10,
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                        }}
                    >
                        <img
                            src={companyLogoUrl}
                            style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', display: 'block' }}
                            alt="Logo"
                            crossOrigin={companyLogoUrl.startsWith('data:') ? undefined : crossOrigin}
                        />
                    </div>
                )}

                {/* Selo de Preço - COPIADO DO PREVIEW */}
                {layoutConfig.sealVisible && layoutConfig.sealUrl && (
                    <div style={{
                        position: 'absolute',
                        left: `${layoutConfig.sealX}%`,
                        top: `${layoutConfig.sealY}%`,
                        transform: `translate(-50%, -50%) scale(${layoutConfig.sealScale * 5})`,
                        zIndex: (layoutConfig.layersOrder?.indexOf('seal') ?? 2) + 10
                    }}>
                        <img
                            src={layoutConfig.sealUrl}
                            style={{ width: '100px', height: '100px', objectFit: 'contain' }}
                            alt="Selo"
                            crossOrigin={layoutConfig.sealUrl.startsWith('data:') ? undefined : crossOrigin}
                        />

                        {/* Preço sobre o Selo */}
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

                {/* Preço sem Selo */}
                {!layoutConfig.sealVisible && layoutConfig.priceVisible && product.price && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.priceX + (layoutConfig.priceXOffset || 0)}%`,
                            top: `${layoutConfig.priceY + (layoutConfig.priceYOffset || 0)}%`,
                            transform: `translate(-50%, -50%) scale(${layoutConfig.priceScale * 1.5})`,
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

                {/* Descrição - COPIADO DO PREVIEW */}
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
                                const baseSize = layoutConfig.fontSizeDescription / 2;
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
                            minHeight: `${(layoutConfig.fontSizeDescription / 2) * 1.5}rem`,
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

                {/* Código Interno - COPIADO DO PREVIEW */}
                {layoutConfig.showInternalCode && product.internalCode && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.codeInternalX}%`,
                            bottom: `${layoutConfig.codeInternalY}%`,
                            transform: 'translateX(-50%)',
                            color: layoutConfig.colorInternalCode,
                            fontSize: `${layoutConfig.fontSizeInternalCode / 2}rem`,
                            fontWeight: 700,
                            zIndex: (layoutConfig.layersOrder?.indexOf('codes') ?? 0) + 10,
                            textShadow: layoutConfig.codeShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                            WebkitTextStroke: layoutConfig.codeStroke ? `1px ${layoutConfig.colorInternalCode === '#ffffff' ? 'black' : 'white'}` : 'none'
                        }}
                    >
                        {product.internalCode}
                    </div>
                )}

                {/* Código EAN - COPIADO DO PREVIEW */}
                {layoutConfig.showEan && product.ean && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.codeEanX}%`,
                            bottom: `${layoutConfig.codeEanY}%`,
                            transform: 'translateX(-50%)',
                            color: layoutConfig.colorEan,
                            fontSize: `${layoutConfig.fontSizeEan / 2}rem`,
                            fontWeight: 700,
                            zIndex: (layoutConfig.layersOrder?.indexOf('codes') ?? 0) + 10,
                            textShadow: layoutConfig.codeShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                            WebkitTextStroke: layoutConfig.codeStroke ? `1px ${layoutConfig.colorEan === '#ffffff' ? 'black' : 'white'}` : 'none'
                        }}
                    >
                        {product.ean}
                    </div>
                )}

                {/* Texto Customizado - COPIADO DO PREVIEW */}
                {layoutConfig.customTextVisible && layoutConfig.customText && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.customTextX}%`,
                            top: `${layoutConfig.customTextY}%`,
                            transform: `translate(-50%, -50%) rotate(${layoutConfig.customTextRotation}deg)`,
                            color: layoutConfig.customTextColor,
                            fontSize: `${layoutConfig.customTextSize / 20}rem`,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            zIndex: (layoutConfig.layersOrder?.indexOf('customText') ?? 4) + 10,
                            textTransform: 'uppercase'
                        }}
                    >
                        {layoutConfig.customText}
                    </div>
                )}

                {/* Watermark - COPIADO DO PREVIEW */}
                {layoutConfig.watermarkVisible && (
                    <div style={{
                        position: 'absolute',
                        left: '4%',
                        top: '50%',
                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                        color: '#efefef',
                        opacity: layoutConfig.watermarkOpacity,
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none'
                    }}>
                        {layoutConfig.watermarkText || 'CanvaZap'}
                    </div>
                )}
            </div>
        </div>
    );
});

LaminaPage.displayName = 'LaminaPage';
