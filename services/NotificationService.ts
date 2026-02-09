
import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum AdminNotificationType {
    INFO = 'info',
    WARNING = 'warning',
    SUCCESS = 'success',
    ERROR = 'error',
    APPROVAL = 'approval'
}

export const sendAdminNotification = async (
    title: string,
    message: string,
    type: AdminNotificationType = AdminNotificationType.INFO,
    link?: string,
    category?: string
) => {
    try {
        await addDoc(collection(db, 'admin_notifications'), {
            title,
            message,
            type,
            status: 'unread',
            createdAt: serverTimestamp(),
            link,
            category
        });
    } catch (e) {
        console.error("Error sending admin notification:", e);
    }
};
