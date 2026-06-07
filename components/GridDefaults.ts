
import { LayoutConfig, GridFormatKey } from './FlyerTypes';

export const GRID_CONFIG_DEFAULTS: Record<GridFormatKey, Partial<LayoutConfig>> = {
    '1x1': {
        columns: 1, rows: 1,
        marginTop: 350, marginBottom: 100, marginLeft: 100, marginRight: 100,
        gap: 0,
        cardPadding: 44,
        spacingBelowPhoto: 0, spacingBelowDescription: 0,
        photoScale: 0.9, photoAreaHeight: 75,
        cardScale: 1.0,
        fontSizeDescription: 1.8, fontSizePrice: 4.5,
        showPriceSeal: true, showInternalCode: true, showEan: true,
        fontInternalCode: 1.2, fontEan: 1.2,
        cardBackgroundMode: 'white', cardOpacity: 0.7, cardRadius: 8,
        logoConfig: { visible: true, x: 16, y: 150, scale: 1.4 },
        sideTextConfig: {
            visible: true, text: "Imagens meramente ilustrativas", fontSize: 12,
            color: "#9ca3af", x: -11, y: 500, rotation: -90, scale: 1
        },
        promoMonth: { visible: false, text: "Mês de Janeiro", fontSize: 18, color: "#333333", x: 50, y: 110 },
        promoBadge: { visible: false, text: "Terça da Carne", fontSize: 24, color: "#cc0000", x: 50, y: 140, scale: 1.2 }
    },
    '2x2': {
        columns: 2, rows: 2,
        marginTop: 300, marginBottom: 10, marginLeft: 30, marginRight: 30,
        gap: 1,
        cardPadding: 54,
        spacingBelowPhoto: 0, spacingBelowDescription: 0,
        photoScale: 1.0, photoAreaHeight: 65,
        cardScale: 0.85,
        fontSizeDescription: 0.8, fontSizePrice: 2.9,
        showPriceSeal: true, showInternalCode: true, showEan: true,
        fontInternalCode: 0.8, fontEan: 0.8,
        cardBackgroundMode: 'white', cardOpacity: 0.7, cardRadius: 8,
        logoConfig: { visible: true, x: 16, y: 150, scale: 1.4 },
        sideTextConfig: {
            visible: true, text: "Imagens meramente ilustrativas", fontSize: 12,
            color: "#9ca3af", x: -11, y: 500, rotation: -90, scale: 1
        },
        promoMonth: { visible: false, text: "Mês de Janeiro", fontSize: 18, color: "#333333", x: 50, y: 110 },
        promoBadge: { visible: false, text: "Terça da Carne", fontSize: 24, color: "#cc0000", x: 50, y: 140, scale: 1.2 }
    },
    '3x2': {
        columns: 3, rows: 2,
        marginTop: 350, marginBottom: 20, marginLeft: 20, marginRight: 20,
        gap: 15,
        cardPadding: 10,
        spacingBelowPhoto: 34, spacingBelowDescription: 0,
        photoScale: 1.05, photoAreaHeight: 70,
        cardScale: 0.95,
        fontSizeDescription: 0.9, fontSizePrice: 2.9,
        showPriceSeal: true, showInternalCode: true, showEan: true,
        fontInternalCode: 1.2, fontEan: 1.2,
        cardBackgroundMode: 'white', cardOpacity: 0.7, cardRadius: 8,
        logoConfig: { visible: true, x: 16, y: 150, scale: 1.4 },
        sideTextConfig: {
            visible: true, text: "Imagens meramente ilustrativas", fontSize: 12,
            color: "#9ca3af", x: -11, y: 500, rotation: -90, scale: 1
        },
        promoMonth: { visible: false, text: "Mês de Janeiro", fontSize: 18, color: "#333333", x: 50, y: 110 },
        promoBadge: { visible: false, text: "Terça da Carne", fontSize: 24, color: "#cc0000", x: 50, y: 140, scale: 1.2 }
    },
    '3x3': {
        columns: 3, rows: 3,
        marginTop: 350, marginBottom: 100, marginLeft: 50, marginRight: 50,
        gap: 15,
        cardPadding: 10,
        spacingBelowPhoto: 0, spacingBelowDescription: 0,
        photoScale: 0.65, photoAreaHeight: 55,
        cardScale: 1.0,
        fontSizeDescription: 0.7, fontSizePrice: 1.9,
        showPriceSeal: true, showInternalCode: true, showEan: true,
        fontInternalCode: 0.8, fontEan: 0.8,
        cardBackgroundMode: 'white', cardOpacity: 0.7, cardRadius: 8,
        logoConfig: { visible: true, x: 16, y: 150, scale: 1.4 },
        sideTextConfig: {
            visible: true, text: "Imagens meramente ilustrativas", fontSize: 12,
            color: "#9ca3af", x: -11, y: 500, rotation: -90, scale: 1
        },
        promoMonth: { visible: false, text: "Mês de Janeiro", fontSize: 18, color: "#333333", x: 50, y: 110 },
        promoBadge: { visible: false, text: "Terça da Carne", fontSize: 24, color: "#cc0000", x: 50, y: 140, scale: 1.2 }
    }
};

/**
 * Retorna as configurações de layout padrão para uma grade específica.
 * Se a grade não estiver nos presets, calcula valores proporcionais baseados no preset '3x2'.
 */
export function getLayoutConfigForGrid(
    columns: number,
    rows: number,
    base?: Partial<LayoutConfig>
): Partial<LayoutConfig> {
    const key = `${columns}x${rows}` as GridFormatKey;

    // Se existe um preset exato, retornamos ele (fazendo merge com a base se fornecida)
    if (GRID_CONFIG_DEFAULTS[key]) {
        return {
            ...GRID_CONFIG_DEFAULTS[key],
            ...(base || {})
        };
    }

    // Valores de referência: '3x2' como base de cálculo
    const REF_COLS = 3;
    const REF_ROWS = 2;
    const REF = GRID_CONFIG_DEFAULTS['3x2'];

    // Fatores de densidade e escala
    const densityFactor = (REF_COLS * REF_ROWS) / (columns * rows);
    const colFactor = REF_COLS / columns;
    const rowFactor = REF_ROWS / rows;
    const sqrtDensity = Math.sqrt(densityFactor);

    return {
        ...REF,
        ...(base || {}),
        columns,
        rows,
        // Margens: reduzem proporcionalmente ao número de colunas/linhas
        marginTop: Math.round((REF.marginTop ?? 350) * Math.min(1.2, rowFactor)), // Limita expansão exagerada
        marginBottom: Math.round((REF.marginBottom ?? 20) * rowFactor),
        marginLeft: Math.round((REF.marginLeft ?? 20) * colFactor),
        marginRight: Math.round((REF.marginRight ?? 20) * colFactor),
        gap: Math.max(4, Math.round((REF.gap ?? 15) * sqrtDensity)),

        // Fontes: escalam com a raiz quadrada da área disponível por card
        fontSizeDescription: parseFloat(((REF.fontSizeDescription ?? 0.9) * sqrtDensity).toFixed(3)),
        fontSizePrice: parseFloat(((REF.fontSizePrice ?? 2.9) * sqrtDensity).toFixed(3)),
        fontInternalCode: parseFloat(((REF.fontInternalCode ?? 1.2) * sqrtDensity).toFixed(3)),
        fontEan: parseFloat(((REF.fontEan ?? 1.2) * sqrtDensity).toFixed(3)),

        // Foto e card
        photoAreaHeight: Math.max(40, Math.min(85, Math.round((REF.photoAreaHeight ?? 70) * sqrtDensity))),
        photoScale: Math.min(1.2, parseFloat(((REF.photoScale ?? 1.05) * sqrtDensity).toFixed(3))),
        cardScale: Math.min(1.1, parseFloat(((REF.cardScale ?? 0.95) * sqrtDensity).toFixed(3))),
        cardPadding: Math.max(4, Math.round((REF.cardPadding ?? 10) * densityFactor)),
    };
}
