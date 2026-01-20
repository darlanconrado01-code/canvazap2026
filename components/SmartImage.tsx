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

    return (
        <img
            src={urls[currentSrcIndex]}
            onError={handleError}
            style={style}
            referrerPolicy="no-referrer"
            crossOrigin={crossOrigin}
        />
    );
};
