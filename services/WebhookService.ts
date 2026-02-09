import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { WebhookEvent, WebhookConfig, User } from '../types';

export const triggerWebhook = async (companyId: string, event: WebhookEvent, payload: any) => {
    try {
        // 1. Fetch active webhooks for this company and event
        const q = query(
            collection(db, 'companies', companyId, 'webhooks'),
            where('active', '==', true)
        );

        const snapshot = await getDocs(q);
        const webhooks = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as WebhookConfig))
            .filter(hook => hook.events.includes(event));

        if (webhooks.length === 0) return;

        // 2. Enrich payload with common data if not present
        // The user requested full names, emails, and phones of people involved.
        // We expect the caller to pass IDs of involved users, and we can fetch them here or the caller does it.
        // Let's assume the caller passes basic info and we enrich if needed.

        const enrichedPayload = {
            event,
            timestamp: new Date().toISOString(),
            companyId,
            data: payload
        };

        // 3. Send requests
        const promises = webhooks.map(hook =>
            fetch(hook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Event': event
                },
                body: JSON.stringify(enrichedPayload)
            }).catch(err => console.error(`Failed to send webhook to ${hook.url}:`, err))
        );

        await Promise.all(promises);
    } catch (error) {
        console.error("Error triggering webhook:", error);
    }
};

/**
 * Utility to fetch full user info for webhook payloads
 */
export const getWebhookUserInfo = async (userId: string) => {
    if (!userId) return null;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
        const data = userDoc.data();
        return {
            id: userId,
            name: data.name || 'N/A',
            email: data.email || 'N/A',
            phone: data.phone || 'N/A'
        };
    }
    return null;
};
