import { getDb, authorize } from "./_utils";

export default async function handler(req: any, res: any) {
    const db = getDb();
    try {
        const company = await authorize(req);
        if (!company) {
            return res.status(401).json({ error: "Chave de API inválida ou ausente." });
        }

        if (req.method === 'GET') {
            const snap = await db.collection('crm_contacts')
                .where('companyId', '==', company.id)
                .get();

            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            return res.status(200).json(list);
        }

        if (req.method === 'POST') {
            const { name, email, phone, tags, customFields } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório." });

            const newContact = {
                name,
                email: email || "",
                phone: phone || "",
                tags: tags || [],
                customFields: customFields || {},
                companyId: company.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = await db.collection('crm_contacts').add(newContact);
            return res.status(201).json({ id: docRef.id, ...newContact });
        }

        return res.status(405).json({ error: "Método não permitido." });
    } catch (error: any) {
        console.error("API ERROR:", error);
        return res.status(500).json({
            error: "Erro interno no servidor.",
            details: error.message
        });
    }
}
