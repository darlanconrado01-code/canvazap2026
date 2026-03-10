import React, { useState, useEffect } from 'react';

interface SmartImageProps {
    urls: string[];
    style: React.CSSProperties;
    fallback: React.ReactNode;
    crossOrigin?: "anonymous" | "use-credentials" | "";
}

export const SmartImage = ({ urls, style, fallback, crossOrigin }: SmartImageProps) => {
    const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset when urls change
        setCurrentSrcIndex(0);
        setHasError(false);
    }, [urls]);

    const handleError = () => {
        if (currentSrcIndex < urls.length - 1) {
            setCurrentSrcIndex(prev => prev + 1);
        } else {
            setHasError(true);
        }
    };

    if (hasError || urls.length === 0) {
        return <>{fallback}</>;
    }

    // Para evitar estiramento no exportador, usamos background-image.
    // Combinado com o container quadrado no FlyerPage, o resultado é matematicamente perfeito.
    return (
        <div
            style={{
                ...style,
                backgroundImage: `url("${urls[currentSrcIndex]}")`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                display: 'block'
            }}
            role="img"
            aria-label="Produto"
        >
            {/* Imagem invisível para manter o carregamento e avisar o onError */}
            <img
                src={urls[currentSrcIndex]}
                onError={handleError}
                style={{ opacity: 0, width: '1px', height: '1px', position: 'absolute', pointerEvents: 'none' }}
                crossOrigin={urls[currentSrcIndex]?.startsWith('blob:') ? undefined : crossOrigin}
                alt=""
            />
        </div>
    );
};
