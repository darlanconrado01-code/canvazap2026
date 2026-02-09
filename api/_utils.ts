
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Lazy initialization function
export function getDb() {
    if (getApps().length === 0) {
        const projectId = (process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "").trim();
        const clientEmail = (process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || "").trim();
        const privateKeyRaw = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

        if (!projectId || !clientEmail || !privateKeyRaw) {
            const missing = [];
            if (!projectId) missing.push('PROJECT_ID');
            if (!clientEmail) missing.push('CLIENT_EMAIL');
            if (!privateKeyRaw) missing.push('PRIVATE_KEY');
            console.error(`Firebase Admin Config Missing: ${missing.join(', ')}`);
            throw new Error(`Firebase Admin Config Missing: ${missing.join(', ')}`);
        }

        try {
            // Robust private key parsing
            let privateKey = privateKeyRaw.trim();
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.substring(1, privateKey.length - 1);
            }
            // Handle escaped newlines from environment variables
            privateKey = privateKey.replace(/\\n/g, '\n');

            initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log("Firebase Admin Initialized (Modular Mode)");
        } catch (error: any) {
            console.error("Firebase Admin Init Error:", error);
            throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
        }
    }

    return getFirestore();
}

// Re-export FieldValue so consumers don't need to import firebase-admin directly
export { FieldValue };

export async function authorize(req: any) {
    const db = getDb(); // This will throw if init fails

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const apiKey = authHeader.split(' ')[1];

    const snap = await db.collection('companies')
        .where('crm.apiKey', '==', apiKey)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const companyDoc = snap.docs[0];
    return {
        id: companyDoc.id,
        ...companyDoc.data()
    };
}
