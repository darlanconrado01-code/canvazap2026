import { db } from '../services/firebaseConfig';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { WebhookEvent } from '../types';

/**
 * Script para configurar o webhook do PetVille para uma empresa específica
 * 
 * Uso:
 * 1. Importe esta função no console do navegador ou em um componente temporário
 * 2. Execute: setupPetVilleWebhook('COMPANY_ID')
 */

export async function setupPetVilleWebhook(companyId: string) {
    const PETVILLE_WEBHOOK_URL = 'https://n8n.canvazap.com.br/webhook-test/2ad84985-7c33-48b3-8651-4ea46d49bce3';

    try {
        // Verifica se já existe um webhook com esse evento
        const q = query(
            collection(db, 'companies', companyId, 'webhooks'),
            where('events', 'array-contains', WebhookEvent.WHATSAPP_BLAST)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            console.log('✅ Webhook para disparos WhatsApp já configurado!');
            const existingWebhook = snapshot.docs[0].data();
            console.log('URL atual:', existingWebhook.url);
            console.log('Status:', existingWebhook.active ? 'Ativo' : 'Inativo');
            return {
                success: true,
                message: 'Webhook já existe',
                webhookId: snapshot.docs[0].id
            };
        }

        // Cria novo webhook
        const webhookData = {
            name: 'Webhook PetVille',
            url: PETVILLE_WEBHOOK_URL,
            events: [WebhookEvent.WHATSAPP_BLAST],
            active: true,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(
            collection(db, 'companies', companyId, 'webhooks'),
            webhookData
        );

        console.log('✅ Webhook PetVille configurado com sucesso!');
        console.log('Webhook ID:', docRef.id);
        console.log('URL:', PETVILLE_WEBHOOK_URL);
        console.log('Eventos:', [WebhookEvent.WHATSAPP_BLAST]);

        return {
            success: true,
            message: 'Webhook criado com sucesso',
            webhookId: docRef.id
        };

    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Erro desconhecido',
            error
        };
    }
}

// Exemplo de uso:
// setupPetVilleWebhook('sua-company-id-aqui');
