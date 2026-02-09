import { getDb } from "./_utils";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Configure R2 Client using the new CLOUDFLARE_ env vars (server-side only)
const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || process.env.VITE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.VITE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.VITE_R2_SECRET_ACCESS_KEY || '',
    },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.VITE_R2_PUBLIC_URL; // Used for constructing the final public URL

export default async function handler(req: any, res: any) {
    // Enable CORS
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
        return res.status(405).json({ error: "Method not allowed" });
    }

    let db;
    try {
        console.log("Initializing DB inside webhook...");
        db = getDb();
    } catch (dbError: any) {
        console.error("Database Init Error:", dbError);
        return res.status(500).json({
            error: "Firebase Initialization Failed",
            details: dbError.message
        });
    }

    try {
        const payload = req.body;
        const items = Array.isArray(payload) ? payload : [payload];
        console.log(`Processing ${items.length} items from Webhook`);

        // Log raw payload for debugging
        try {
            await db.collection('webhook_logs').add({
                timestamp: new Date().toISOString(),
                method: req.method,
                body: payload,
                source: 'n8n_merchandising_fixed'
            });
        } catch (e) { console.error("Log error", e); }

        const entriesCollection = db.collection('merchandise_entries');
        const processedIds = [];

        for (const item of items) {
            // Flexible extraction logic
            const body = item.body || item;
            const data = body.data || {};
            const message = data.message || body.message || {};

            let senderName = data.pushName || message.senderName || body.senderName || item['Nome da Instância'] || 'Desconhecido';
            let sender = data.key?.remoteJid || message.sender || body.sender || '';
            let groupId = data.key?.remoteJid?.includes('@g.us') ? data.key.remoteJid : (item['ID DO GRUPO'] || message.chatlid || '');
            let groupName = item['Nome do Grupo'] || message.groupName || (groupId.includes('@g.us') ? 'WhatsApp Group' : 'Privado');

            // Image handling
            const imageMessage = message.imageMessage || {};
            let imageUrl = imageMessage.url || message.imageUrl || data.imageUrl || message.content?.url || '';
            // Added support for 'imageBase64' key which is common in some inputs
            let base64 = message.base64 || data.base64 || body.base64 || message.imageBase64 || data.imageBase64 || body.imageBase64 || '';
            let caption = imageMessage.caption || message.caption || body.caption || '';
            let timestamp = message.timestamp || item.timestamp || new Date().toISOString();

            let finalUrl = '';

            // 1. If Base64 provided, UPLOAD TO R2 (The Fix)
            if (base64) {
                try {
                    console.log(`Uploading base64 image for sender ${senderName}...`);
                    const buffer = Buffer.from(base64, 'base64');
                    // Clean sender name for filename
                    const safeName = senderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const fileName = `webhook_uploads/${Date.now()}_${safeName}.jpeg`;

                    const command = new PutObjectCommand({
                        Bucket: R2_BUCKET,
                        Key: fileName,
                        Body: buffer,
                        ContentType: 'image/jpeg'
                    });

                    await r2Client.send(command);

                    // Construct Public URL
                    if (R2_PUBLIC_URL) {
                        const baseUrl = R2_PUBLIC_URL.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
                        finalUrl = `${baseUrl}/${fileName}`;
                    } else {
                        finalUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${fileName}`;
                    }
                    console.log(`Upload success: ${finalUrl}`);
                } catch (uploadError: any) {
                    console.error("R2 Upload Failed:", uploadError);
                    // Fallback: Don't save image, or save error? Proceeding without image to avoid crash.
                }
            }
            // 2. If URL provided, use it directly
            else if (imageUrl) {
                finalUrl = imageUrl;
            }

            // Only save to Firestore if we have a valid image URL now
            if (finalUrl) {
                const docRef = await entriesCollection.add({
                    companyId: 'ADMIN_GLOBAL', // Or try to map from sender if possible
                    sender,
                    senderName,
                    groupId,
                    groupName,
                    imageUrl: finalUrl,
                    caption,
                    createdAt: new Date().toISOString(),
                    receivedAt: timestamp,
                    status: 'new',
                    webhookSource: 'merchan-fixed-v3'
                });
                processedIds.push(docRef.id);
            }
        }

        return res.status(200).json({
            success: true,
            processed_count: processedIds.length,
            ids: processedIds
        });

    } catch (error: any) {
        console.error("Webhook Fixed processing error:", error);
        return res.status(500).json({ error: error.message, stack: error.stack });
    }
}
