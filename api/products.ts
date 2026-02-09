import { getDb, authorize } from "./_utils";

export default async function handler(req: any, res: any) {
    const db = getDb();
    // CORS headers
    try {
        const company = await authorize(req);
        if (!company) {
            return res.status(401).json({ error: "Chave de API inválida ou ausente." });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Apenas POST é permitido neste endpoint." });
        }

        const { name, ean, internalCode, imageUrl, price, offerPrice, unit } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Nome do produto é obrigatório." });
        }

        const productData = {
            name,
            ean: ean || "",
            internalCode: internalCode || "",
            imageUrl: imageUrl || "",
            price: price || null,
            offerPrice: offerPrice || null,
            unit: unit || "UN",
            companyId: company.id,
            source: 'api',
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('product_images').add(productData);

        return res.status(201).json({
            success: true,
            id: docRef.id,
            message: "Produto recebido com sucesso."
        });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno ao processar produto." });
    }
}
