export interface Theme {
    id: string;
    name: string;
    backgroundEncartes: string;
    coverUrl?: string;
    isActive?: boolean;
    availability: string[]; // 'encartes', 'catalogo'
    tags?: string[];
    isPublic?: boolean;
    companyId?: string;
    allowedCompanies?: string[];
    defaultLayoutConfig?: any; // Stores the saved layout configuration
}

export interface ProductItem {
    id: string; // temp id
    rawText: string;
    description: string;
    price: string;
    ean?: string;
    internalCode?: string;
    candidateUrls: string[];
    loadingFirestore?: boolean;
    isLinked?: boolean;
    // We keep imageUrl for compatibility but rely on candidateUrls
    imageUrl?: string;
    loadingImage?: boolean; // Generic loading state
}

export interface LayoutConfig {
    columns: number;
    rows: number;
    gap: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    colorDescription: string;
    colorPrice: string;
    colorCode: string;
    colorInternalCode: string;
    colorEan: string;
    colorPackaging: string;
    showPriceSeal: boolean;
    showInternalCode: boolean;
    showEan: boolean;
    fontInternalCode: number;
    fontEan: number;
    fontSizeDescription: number;
    fontSizePrice: number;
    cardBackgroundMode: string;
    cardOpacity: number;
    cardRadius: number;
    cardPadding: number;
    spacingBelowPhoto: number;
    spacingBelowDescription: number;
    spacingAbovePrice: number;
    priceCentsSpacing: number;
    photoScale: number;
    logoConfig?: {
        x: number;
        y: number;
        scale: number;
        visible: boolean;
    };
    sideTextConfig: {
        text: string;
        fontSize: number;
        color: string;
        x: number;
        y: number;
        scale: number;
        rotation: number;
        visible: boolean;
    };
    elementsOrder?: string[];
}
