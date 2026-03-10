import React, { forwardRef } from 'react';
import { ProductItem } from './FlyerTypes';
import { SmartImage } from './SmartImage';
import { ImageIcon } from 'lucide-react';

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
    // Configuração de Alta Resolução (Match com o Orchestrator)
    const INT_SCALE = 2;

    const getBaseDimensions = () => {
        switch (selectedFormat) {
            case 'stories': return { width: 1080, height: 1920 };
            case 'feed': return { width: 1080, height: 1350 };
            case 'tv': return { width: 1920, height: 1080 };
            case 'post':
            default: return { width: 1080, height: 1080 };
        }
    };

    const base = getBaseDimensions();
    // Dimensões internas reais (2x)
    const PAGE_W = base.width * INT_SCALE;
    const PAGE_H = base.height * INT_SCALE;

    // Se estiver exportando, usamos escala 1 (tamanho real interno). 
    // Se for preview, multiplicamos a escala desejada pelo inverso da escala interna
    const displayScale = isExport ? 1 : scale / INT_SCALE;

    // Helpers dinâmicos baseados na escala interna
    const spx = (val: number | undefined) => `${(val || 0) * INT_SCALE}px`;
    const srem = (val: number | undefined) => `${(val || 0) * 16 * INT_SCALE}px`;

    // Helper para formatar preço
    const formatPrice = (price: string) => {
        if (!price) return null;
        const match = price.match(/R?\$?\s*(\d+)[,.](\d{2})/);
        if (!match) return null;
        return { int: match[1], cents: match[2] };
    };

    // Unificando URLs para o SmartImage
    const productUrls = [
        ...(product.imageUrl ? [product.imageUrl] : []),
        ...(product.candidateUrls || [])
    ].filter(u => !!u);

    return (
        <div
            className="lamina-page-preview-container"
            style={{
                width: `${PAGE_W * displayScale}px`,
                height: `${PAGE_H * displayScale}px`,
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
                    boxShadow: isExport ? 'none' : '0 10px 30px rgba(0,0,0,0.1)'
                }}
            >
                {/* Gradiente TV */}
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

                {/* Imagem do Produto (SmartImage) */}
                <div
                    style={{
                        position: 'absolute',
                        left: selectedFormat === 'tv' && layoutConfig.tvGradientVisible
                            ? `${(layoutConfig.tvGradientDirection === 'right' ? 30 : 70) + ((layoutConfig.productX || 50) - 50)}%`
                            : `${layoutConfig.productX || 50}%`,
                        top: `${layoutConfig.productY || 50}%`,
                        width: `${(layoutConfig.productScale || 1) * 100}%`,
                        height: `${(layoutConfig.productScale || 1) * 100}%`,
                        transform: `translate(-50%, calc(-50% + ${spx(layoutConfig.yOffset)}))`,
                        zIndex: 0
                    }}
                >
                    {productUrls.length > 0 ? (
                        <SmartImage
                            urls={productUrls}
                            style={{ width: '100%', height: '100%' }}
                            crossOrigin={crossOrigin}
                            fallback={
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                                    <ImageIcon size={120 * INT_SCALE} color="#cbd5e1" />
                                </div>
                            }
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                            <ImageIcon size={120 * INT_SCALE} color="#cbd5e1" />
                        </div>
                    )}
                </div>

                {/* Company Logo */}
                {companyLogoUrl && layoutConfig.logoVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.logoX ?? 50}%`,
                            top: `${layoutConfig.logoY ?? 14}%`,
                            // Usamos um container fixo para garantir centralização perfeita no motor de captura
                            width: spx(600),
                            height: spx(600),
                            marginLeft: spx(-300),
                            marginTop: spx(-300),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: (layoutConfig.layersOrder?.indexOf('logo') ?? 3) + 10,
                        }}
                    >
                        <img
                            src={companyLogoUrl}
                            style={{
                                // Calculamos o tamanho final diretamente em vez de usar scale()
                                width: spx(120 * (layoutConfig.logoScale || 0.24) * 8),
                                height: spx(120 * (layoutConfig.logoScale || 0.24) * 8),
                                objectFit: 'contain',
                                display: 'block',
                                filter: `drop-shadow(0 ${spx(2)} ${spx(4)} rgba(0,0,0,0.2))`
                            }}
                            alt="Logo"
                            crossOrigin={companyLogoUrl.startsWith('data:') ? undefined : crossOrigin}
                        />
                    </div>
                )}

                {/* Selo de Preço */}
                {layoutConfig.sealVisible && layoutConfig.sealUrl && (
                    <div style={{
                        position: 'absolute',
                        left: `${layoutConfig.sealX}%`,
                        top: `${layoutConfig.sealY}%`,
                        width: spx(800),
                        height: spx(800),
                        marginLeft: spx(-400),
                        marginTop: spx(-400),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: (layoutConfig.layersOrder?.indexOf('seal') ?? 2) + 10
                    }}>
                        <div style={{ position: 'relative', width: 'fit-content', height: 'fit-content' }}>
                            <img
                                src={layoutConfig.sealUrl}
                                style={{
                                    width: spx(150 * (layoutConfig.sealScale * 5)),
                                    height: spx(150 * (layoutConfig.sealScale * 5)),
                                    objectFit: 'contain'
                                }}
                                alt="Selo"
                                crossOrigin={layoutConfig.sealUrl.startsWith('data:') ? undefined : crossOrigin}
                            />

                            {/* Preço sobre o Selo */}
                            {layoutConfig.priceVisible && product.price && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${50 + (layoutConfig.priceXOffset || 0)}%`,
                                    top: `${50 + (layoutConfig.priceYOffset || 0)}%`,
                                    transform: 'translate(-50%, -50%)',
                                    color: layoutConfig.colorPrice,
                                    fontWeight: 950,
                                    // Combinamos o scale original no fontSize para remover o transform: scale
                                    fontSize: srem(8 * (layoutConfig.priceScale || 1)),
                                    textShadow: `0 ${spx(4)} ${spx(10)} rgba(0,0,0,0.3)`,
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {(() => {
                                        const parts = formatPrice(product.price);
                                        if (!parts) return null;
                                        return (
                                            <div style={{ display: 'flex', flexDirection: layoutConfig.currencySymbolPosition === 'top' ? 'column' : 'row', alignItems: layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start'), lineHeight: 0.8 }}>
                                                {layoutConfig.currencySymbolVisible && (
                                                    <span style={{
                                                        fontSize: `${layoutConfig.currencySymbolScale || 0.7}em`,
                                                        marginRight: layoutConfig.currencySymbolPosition === 'top' ? '0' : spx(5),
                                                        marginBottom: layoutConfig.currencySymbolPosition === 'top' ? spx(-10) : '0',
                                                        alignSelf: layoutConfig.currencySymbolPosition === 'before' ? 'center' : (layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start')),
                                                        marginTop: layoutConfig.currencySymbolPosition === 'superscript' ? spx(4) : '0',
                                                        transform: `translate(${spx(layoutConfig.priceCurrencyXOffset)}, ${spx(layoutConfig.priceCurrencyYOffset)})`,
                                                        display: 'inline-block'
                                                    }}>R$</span>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                    <span style={{ transform: `translate(${spx(layoutConfig.priceRealXOffset)}, ${spx(layoutConfig.priceRealYOffset)})`, display: 'inline-block' }}>{parts.int}</span>
                                                    <span style={{
                                                        fontSize: `${layoutConfig.priceCentsScale || 0.6}em`,
                                                        marginTop: spx(10),
                                                        transform: `translate(${spx(layoutConfig.priceCentsXOffset)}, ${spx(layoutConfig.priceCentsYOffset)})`,
                                                        display: 'inline-block'
                                                    }}>,{parts.cents}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
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
                            transform: 'translate(-50%, -50%)',
                            color: layoutConfig.colorPrice,
                            fontWeight: 950,
                            // Combinamos a escala no tamanho da fonte
                            fontSize: srem(8 * (layoutConfig.priceScale * 2)),
                            textShadow: `0 ${spx(4)} ${spx(10)} rgba(0,0,0,0.3)`,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {(() => {
                            const parts = formatPrice(product.price);
                            if (!parts) return null;
                            return (
                                <div style={{ display: 'flex', flexDirection: layoutConfig.currencySymbolPosition === 'top' ? 'column' : 'row', alignItems: layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start'), lineHeight: 0.8 }}>
                                    {layoutConfig.currencySymbolVisible && (
                                        <span style={{
                                            fontSize: `${layoutConfig.currencySymbolScale || 0.7}em`,
                                            marginRight: layoutConfig.currencySymbolPosition === 'top' ? '0' : spx(5),
                                            marginBottom: layoutConfig.currencySymbolPosition === 'top' ? spx(-10) : '0',
                                            alignSelf: layoutConfig.currencySymbolPosition === 'before' ? 'center' : (layoutConfig.currencySymbolPosition === 'subscript' ? 'flex-end' : (layoutConfig.currencySymbolPosition === 'top' ? 'center' : 'flex-start')),
                                            marginTop: layoutConfig.currencySymbolPosition === 'superscript' ? spx(4) : '0',
                                            transform: `translate(${spx(layoutConfig.priceCurrencyXOffset)}, ${spx(layoutConfig.priceCurrencyYOffset)})`,
                                            display: 'inline-block'
                                        }}>R$</span>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                        <span style={{ transform: `translate(${spx(layoutConfig.priceRealXOffset)}, ${spx(layoutConfig.priceRealYOffset)})`, display: 'inline-block' }}>{parts.int}</span>
                                        <span style={{
                                            fontSize: `${layoutConfig.priceCentsScale || 0.6}em`,
                                            marginTop: spx(10),
                                            transform: `translate(${spx(layoutConfig.priceCentsXOffset)}, ${spx(layoutConfig.priceCentsYOffset)})`,
                                            display: 'inline-block'
                                        }}>,{parts.cents}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Descrição */}
                {layoutConfig.descVisible && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: 0,
                            width: '100%',
                            bottom: `${layoutConfig.descY}%`,
                            color: layoutConfig.colorDescription,
                            fontSize: (() => {
                                const baseSize = 4 * (layoutConfig.fontSizeDescription || 1);
                                const text = product.normalizedDescription || product.description || '';
                                let size = baseSize;
                                if (text.length > 60) size *= 0.7;
                                else if (text.length > 40) size *= 0.82;
                                else if (text.length > 25) size *= 0.92;
                                return srem(size);
                            })(),
                            fontWeight: 800,
                            textAlign: 'center',
                            zIndex: (layoutConfig.layersOrder?.indexOf('description') ?? 1) + 10,
                            height: 'auto',
                            minHeight: srem(2),
                            lineHeight: '1.1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: `${spx(1.6)} 0`,
                            textShadow: layoutConfig.colorDescription === '#ffffff' ? `0 ${spx(2)} ${spx(4)} rgba(0,0,0,0.5)` : 'none'
                        }}
                    >
                        <span style={{
                            display: 'block',
                            width: '90%',
                            margin: '0 auto',
                            overflow: 'visible',
                            wordBreak: 'break-word'
                        }}>
                            {product.normalizedDescription || product.description}
                        </span>
                    </div>
                )}

                {/* Código Interno */}
                {layoutConfig.showInternalCode && product.internalCode && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.codeInternalX}%`,
                            bottom: `${layoutConfig.codeInternalY}%`,
                            transform: 'translateX(-50%)',
                            color: layoutConfig.colorInternalCode,
                            fontSize: srem(layoutConfig.fontSizeInternalCode),
                            fontWeight: 700,
                            zIndex: (layoutConfig.layersOrder?.indexOf('codes') ?? 0) + 10,
                            textShadow: layoutConfig.codeShadow ? `0 0 ${spx(4)} rgba(0,0,0,0.8)` : 'none',
                            whiteSpace: 'nowrap',
                            width: 'auto'
                        }}
                    >
                        {product.internalCode}
                    </div>
                )}

                {/* Código EAN */}
                {layoutConfig.showEan && product.ean && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.codeEanX}%`,
                            bottom: `${layoutConfig.codeEanY}%`,
                            transform: 'translateX(-50%)',
                            color: layoutConfig.colorEan,
                            fontSize: srem(layoutConfig.fontSizeEan),
                            fontWeight: 700,
                            zIndex: (layoutConfig.layersOrder?.indexOf('codes') ?? 0) + 10,
                            textShadow: layoutConfig.codeShadow ? `0 0 ${spx(4)} rgba(0,0,0,0.8)` : 'none',
                            whiteSpace: 'nowrap',
                            width: 'auto'
                        }}
                    >
                        {product.ean}
                    </div>
                )}

                {/* Texto Customizado */}
                {layoutConfig.customTextVisible && layoutConfig.customText && (
                    <div
                        data-export-text="true"
                        style={{
                            position: 'absolute',
                            left: `${layoutConfig.customTextX}%`,
                            top: `${layoutConfig.customTextY}%`,
                            transform: `translate(-50%, -50%) rotate(${layoutConfig.customTextRotation}deg)`,
                            color: layoutConfig.customTextColor,
                            fontSize: spx(layoutConfig.customTextSize),
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            zIndex: (layoutConfig.layersOrder?.indexOf('customText') ?? 4) + 10,
                            textTransform: 'uppercase'
                        }}
                    >
                        {layoutConfig.customText}
                    </div>
                )}

                {/* Watermark */}
                {layoutConfig.watermarkVisible && (
                    <div style={{
                        position: 'absolute',
                        left: '4%',
                        top: '50%',
                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                        color: '#efefef',
                        opacity: layoutConfig.watermarkOpacity,
                        fontSize: spx(14),
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
