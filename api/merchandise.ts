import { getDb, authorize } from "./_utils";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.VITE_R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL;

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
});

export default async function handler(req: any, res: any) {
    // Enable CORS per Vercel standard if needed, or rely on Vercel config
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido" });
    }

    const db = getDb();

    try {
        const company = await authorize(req);
        if (!company) {
            return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
        }

        const { sender, pushName, groupId, groupSubject, imageBase64, imageUrl: inputImageUrl, caption, timestamp } = req.body;

        if (!imageBase64 && !inputImageUrl) {
            return res.status(400).json({ error: "Missing image data (imageBase64 or imageUrl)" });
        }

        let finalImageUrl = "";

        if (imageBase64) {
            // Upload to R2
            const buffer = Buffer.from(imageBase64, 'base64');
            const fileName = `merchandise/${company.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpeg`;

            const command = new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileName,
                Body: buffer,
                ContentType: 'image/jpeg'
            });

            await s3Client.send(command);

            finalImageUrl = R2_PUBLIC_URL
                ? `${R2_PUBLIC_URL.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL}/${fileName}`
                : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileName}`;
        } else {
            // Use provided URL directly (less reliable if it expires, but solves the immediate block)
            finalImageUrl = inputImageUrl;
        }

        // Save to Firestore
        const docRef = await db.collection('merchandise_entries').add({
            companyId: company.id,
            sender: sender || 'Unknown',
            senderName: pushName || 'Unknown',
            groupId: groupId || '',
            groupName: groupSubject || '',
            imageUrl: finalImageUrl,
            caption: caption || '',
            createdAt: new Date().toISOString(),
            receivedAt: timestamp || new Date().toISOString(),
            status: 'new'
        });

        return res.status(200).json({ success: true, id: docRef.id, imageUrl: finalImageUrl });

    } catch (error: any) {
        console.error("Merchandise API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
