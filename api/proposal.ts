import { getDb, FieldValue } from './_utils';

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Try to get DB connection first, return clear auth error if fails
    let db;
    try {
        db = getDb();
    } catch (dbError: any) {
        console.error("Database Init Failed:", dbError.message);
        return res.status(500).json({ error: `Configuration Error: ${dbError.message}` });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "id" parameter' });
    }

    if (req.method === 'GET') {
        try {
            const docRef = db.collection('budget_proposals').doc(id);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                return res.status(404).json({ error: 'Proposal not found' });
            }

            // Update stats
            await docRef.update({
                viewCount: FieldValue.increment(1),
                lastViewedAt: FieldValue.serverTimestamp()
            });

            // Convert date objects to ISO strings for JSON serialization
            const data = docSnap.data();
            if (data?.createdAt?.toDate) data.createdAt = data.createdAt.toDate().toISOString();
            if (data?.expiresAt?.toDate) data.expiresAt = data.expiresAt.toDate().toISOString();
            // lastViewedAt will be updated but we might return the old one or just omit. 
            // Let's just return the data as is, handling dates on client

            // Actually, Firestore server timestamps in admin SDK might not Serialize well in JSON response directly
            // Better to convert Timestamps to dates/strings
            const responseData = { id: docSnap.id, ...data };
            Object.keys(responseData).forEach(key => {
                if (responseData[key] && typeof responseData[key].toDate === 'function') {
                    responseData[key] = responseData[key].toDate().toISOString();
                }
            });

            return res.status(200).json(responseData);
        } catch (error: any) {
            console.error('Error fetching proposal:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else if (req.method === 'POST') {
        // Handle Status Update
        try {
            const { status } = req.body;
            if (status !== 'approved' && status !== 'rejected') {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const docRef = db.collection('budget_proposals').doc(id);
            await docRef.update({ status });

            // Note: The Webhook trigger currently lives in the Client (PublicProposal.tsx).
            // We can keep it there or move it here. 
            // Moving it here is cleaner, but keeping it on client is faster to implement without duplicating logic right now.
            // Client already checks for webhookUrl.
            // Actually, if we use API, we might lose the 'webhookUrl' return if we don't return it in GET.
            // We are returning spread data, so webhookUrl will be there.

            return res.status(200).json({ success: true });
        } catch (error: any) {
            console.error('Error updating proposal:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
