
export interface NormalizedProduct {
    cod: string;
    description: string;
    normalizedDescription: string;
    packaging: string;
    price: string;
    priceInt: string;
    priceDec: string;
    ean: string;
}

export const sanitizeAndNormalize = (line: string): NormalizedProduct => {
    // COD | DESCRIÇÃO | EMBALAGEM | PREÇO (com R$) | parte inteira | parte decimal | EAN
    // Example: 56323 REFRIG.COCA COLA ORIGINAL PET 2LT C/6UN 1/2LT R$ 10,99 10 99 7894900027013

    let cod = '';
    let description = '';
    let packaging = '';
    let price = '';
    let priceInt = '';
    let priceDec = '';
    let ean = '';

    // Try to match the structured format first
    // We look for Price R$ XX,XX followed by two numbers (int/dec) and an EAN
    const structuredMatch = line.match(/^(\d+)\s+(.+?)\s+(.+?)\s+(R\$\s*\d+[,.]\d{2})\s+(\d+)\s+(\d+)\s+(\d{8,14})$/);

    if (structuredMatch) {
        cod = structuredMatch[1];
        description = structuredMatch[2];
        packaging = structuredMatch[3];
        price = structuredMatch[4];
        priceInt = structuredMatch[5];
        priceDec = structuredMatch[6];
        ean = structuredMatch[7];
    } else {
        // Fallback to legacy parsing if format is different
        let tempLine = line;

        // Extract Price
        const priceMatch = tempLine.match(/(?:R\$\s*)?(\d+[.,]\d{2})(?!\d)/);
        if (priceMatch) {
            price = priceMatch[0];
            const cleanPrice = price.replace('R$', '').trim().split(/[.,]/);
            priceInt = cleanPrice[0];
            priceDec = cleanPrice[1] || '00';
            tempLine = tempLine.replace(priceMatch[0], '').trim();
        }

        // Extract EAN
        const eanMatch = tempLine.match(/(\d{8,14})/);
        if (eanMatch) {
            ean = eanMatch[0];
            tempLine = tempLine.replace(ean, '').trim();
        }

        // Extract COD (first number)
        const codMatch = tempLine.match(/^(\d+)/);
        if (codMatch && codMatch[0] !== ean) {
            cod = codMatch[0];
            tempLine = tempLine.replace(new RegExp(`^${cod}`), '').trim();
        }

        description = tempLine;
    }

    // Apply Normalization Rules to description
    let norm = description.toUpperCase();

    // 1. substitui / por espaço (ex.: COCO/AMENDOAS → COCO AMENDOAS)
    norm = norm.replace(/\//g, ' ');

    // 2. substituir & por espaço (ex.: OR.&CINNAMON → OR CINNAMON)
    norm = norm.replace(/&/g, ' ');

    // 3. reduzir múltiplos espaços para apenas 1
    norm = norm.replace(/\s+/g, ' ');

    // 4. remover pontos duplicados e normalizar abreviações (ex.: REFRIG.COCA COLA → REFRIG COCA COLA)
    norm = norm.replace(/\.\.+/g, ' ');
    // Normalize common prefixes/abbreviations by removing dot
    const commonAbbr = ['REFRIG', 'BEB', 'SAB', 'CERV', 'VINHO', 'SUCO', 'LIMP', 'PF', 'C', 'PG', 'LV', 'UND', 'UN', 'PT', 'PET'];
    commonAbbr.forEach(abbr => {
        const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
        norm = norm.replace(regex, `${abbr} `);
    });
    // General dot removal if it's not a decimal point in a number
    norm = norm.replace(/\.(?!\d)/g, ' ');

    // 5. Padronizar unidades (2LT → 2L, 1LT → 1L)
    norm = norm.replace(/(\d+)\s*LT\b/g, '$1L');

    // 5.b Padronizar litros com vírgula para ponto (ex: 1,8L → 1.8L) - User requested for "campos numéricos" but often appears in description
    norm = norm.replace(/(\d+),(\d+)L\b/g, '$1.$2L');

    // 6. Padronizar packs (C/6UN, C/6UND → PACK 6 UN)
    norm = norm.replace(/\bC\s?[\/\s]?\s?(\d+)\s?UN(D)?\b/g, 'PACK $1 UN');

    // 7. Padronizar PG11 LV12 → PG 11 LV 12
    norm = norm.replace(/\bPG\s?(\d+)\s?LV\s?(\d+)\b/g, 'PG $1 LV $2');

    // 8. Padronizar símbolos (ºC → GRAUS)
    norm = norm.replace(/ºC/g, ' GRAUS');

    // 9. Remove prefixos de categoria se começarem a frase
    const categoryPrefixes = ['BEB ', 'REFRIG ', 'SAB ', 'CERV ', 'VINHO ', 'SUCO ', 'LIMP '];
    categoryPrefixes.forEach(prefix => {
        if (norm.startsWith(prefix)) {
            norm = norm.substring(prefix.length).trim();
        }
    });

    // Final cleanup
    norm = norm.replace(/\s+/g, ' ').trim();

    return {
        cod,
        description,
        normalizedDescription: norm,
        packaging,
        price: price.replace('R$', '').trim(),
        priceInt,
        priceDec,
        ean
    };
};
