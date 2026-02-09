
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
