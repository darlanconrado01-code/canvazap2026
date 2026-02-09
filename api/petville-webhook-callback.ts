import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializa Firebase Admin
if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();

/**
 * Endpoint para receber callback do N8N com resultado dos disparos
 * 
 * O N8N deve enviar um POST para esta URL com o seguinte formato:
 * 
 * SUCESSO:
 * {
 *   "campaignId": "abc123",
 *   "recordId": "xyz789",
 *   "status": "success",
 *   "telefone_e164": "+5591981128051",
 *   "messageId": "msg_12345",
 *   "sentAt": "2026-02-09T15:30:00Z"
 * }
 * 
 * FALHA:
 * {
 *   "campaignId": "abc123",
 *   "recordId": "xyz789",
 *   "status": "failed",
 *   "telefone_e164": "+5591981128051",
 *   "error": "Número inválido",
 *   "errorCode": "INVALID_NUMBER"
 * }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Apenas aceita POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaignId, recordId, status, telefone_e164, messageId, error, errorCode, sentAt } = req.body;

        // Validações básicas
        if (!campaignId || !recordId || !status || !telefone_e164) {
            return res.status(400).json({
                error: 'Campos obrigatórios: campaignId, recordId, status, telefone_e164'
            });
        }

        if (!['success', 'failed'].includes(status)) {
            return res.status(400).json({
                error: 'Status deve ser "success" ou "failed"'
            });
        }

        console.log(`📥 Callback recebido - Campaign: ${campaignId}, Record: ${recordId}, Status: ${status}`);

        // Atualiza o registro individual
        const recordRef = db.collection('petville_blasts').doc(recordId);
        const recordDoc = await recordRef.get();

        if (!recordDoc.exists) {
            console.warn(`⚠️ Registro não encontrado: ${recordId}`);
            return res.status(404).json({ error: 'Registro não encontrado' });
        }

        const updateData: any = {
            status,
            updatedAt: new Date().toISOString()
        };

        if (status === 'success') {
            updateData.messageId = messageId;
            updateData.deliveredAt = sentAt || new Date().toISOString();
        } else {
            updateData.error = error;
            updateData.errorCode = errorCode;
            updateData.failedAt = new Date().toISOString();
        }

        await recordRef.update(updateData);
        console.log(`✅ Registro atualizado: ${recordId} - ${status}`);

        // Verifica se todos os registros da campanha foram processados
        const campaignRecordsSnapshot = await db.collection('petville_blasts')
            .where('campaignId', '==', campaignId)
            .get();

        const totalRecords = campaignRecordsSnapshot.size;
        let successCount = 0;
        let failedCount = 0;
        let programadoCount = 0;

        campaignRecordsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'success') successCount++;
            else if (data.status === 'failed') failedCount++;
            else if (data.status === 'programado') programadoCount++;
        });

        // Se todos foram processados, atualiza status da campanha
        if (programadoCount === 0) {
            const campaignRef = db.collection('petville_campaigns').doc(campaignId);
            await campaignRef.update({
                status: 'concluido',
                successCount,
                failedCount,
                completedAt: new Date().toISOString()
            });
            console.log(`🎉 Campanha concluída: ${campaignId} - ${successCount} sucessos, ${failedCount} falhas`);
        }

        return res.status(200).json({
            success: true,
            message: 'Callback processado com sucesso',
            recordId,
            status,
            campaignStatus: programadoCount === 0 ? 'concluido' : 'processando',
            stats: {
                total: totalRecords,
                success: successCount,
                failed: failedCount,
                pending: programadoCount
            }
        });

    } catch (error) {
        console.error('❌ Erro ao processar callback:', error);
        return res.status(500).json({
            error: 'Erro interno ao processar callback',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
}
