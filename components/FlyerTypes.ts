// Grid format key type
export type GridFormatKey = '1x1' | '2x2' | '3x2' | '3x3';

// Grid format definition
export interface GridFormat {
    key: GridFormatKey;
    label: string;
    columns: number;
    rows: number;
    items: number;
}

// Available grid formats
export const GRID_FORMATS: GridFormat[] = [
    { key: '1x1', label: '1×1', columns: 1, rows: 1, items: 1 },
    { key: '2x2', label: '2×2', columns: 2, rows: 2, items: 4 },
    { key: '3x2', label: '3×2', columns: 3, rows: 2, items: 6 },
    { key: '3x3', label: '3×3', columns: 3, rows: 3, items: 9 },
];

export interface Theme {
    id: string;
    name: string;
    backgroundEncartes: string;
    coverUrl?: string;
    imageUrl?: string; // Legacy support or alias
    isActive?: boolean;
    availability: string[]; // 'encartes', 'catalogo'
    categories?: string[]; // Business categories
    subcategories?: string[]; // Business subcategories
    isPublic?: boolean;
    companyId?: string;
    allowedCompanies?: string[];
    defaultLayoutConfig?: any; // Legacy: single layout config
    // NEW: Grid-specific configurations
    gridConfigs?: {
        [key in GridFormatKey]?: {
            layoutConfig: any;
            isConfigured: boolean;
        };
    };
    defaultPromoMonth?: string;
    defaultPromoBadge?: string;
    month?: number; // 1-12 for Jan-Dec, 0 or undefined for none
    isConfigured?: boolean; // True if ALL grid formats are configured
    configuredFormats?: GridFormatKey[]; // List of formats that have been configured
    status?: 'active' | 'pending' | 'archived' | 'draft';
    inheritedFromCompany?: string;
}

export interface ProductItem {
    id: string; // temp id
    rawText: string;
    description: string;
    normalizedDescription?: string;
    price: string;
    ean?: string;
    internalCode?: string;
    category?: string;
    packaging?: string;
    candidateUrls: string[];
    loadingFirestore?: boolean;
    isLinked?: boolean;
    // We keep imageUrl for compatibility but rely on candidateUrls
    imageUrl?: string;
    loadingImage?: boolean; // Generic loading state
    // Size multiplier for product highlighting (1 = normal, 2 = double, 3 = triple)
    sizeMultiplier?: 1 | 2 | 3;
}

export interface LayoutConfig {
    columns: number;
    rows: number;
    gap: number;
    rowGap?: number;
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
    cardScale: number;
    photoAreaHeight: number;
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
    promoBadge?: {
        text: string;
        fontSize: number;
        color: string;
        x: number; // %
        y: number; // px
        scale: number;
        visible: boolean;
    };
    promoMonth?: {
        text: string;
        fontSize: number;
        color: string;
        x: number; // %
        y: number; // px
        visible: boolean;
    };
}
