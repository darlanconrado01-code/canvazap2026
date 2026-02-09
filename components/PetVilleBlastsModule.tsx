import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
    FileText,
    Send,
    Trash2,
    Download,
    Clipboard,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Info,
    Smartphone,
    XCircle,
    Syringe,
    Shield,
    Calendar,
    History,
    ChevronRight,
    Eye
} from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { collection, writeBatch, doc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { WebhookEvent } from '../types';

interface PetVilleRecord {
    DataOriginal: string;
    DataConvertida: string;
    Cliente: string;
    CodCliente: string;
    TelefoneOriginal: string;
    TelefoneE164: string | null;
    Animal: string;
    CodAnimal: string;
    Produto: string;
    valid: boolean;
    note: string;
}

interface Campaign {
    id: string;
    name: string;
    tipo: 'vaccine' | 'antiparasitic';
    createdAt: Date;
    totalRecords: number;
    validRecords: number;
    companyId: string;
    sentBy: string;
}

type BlastType = 'vaccine' | 'antiparasitic';

const PetVilleBlastsModule = () => {
    const { userData } = useAuth();
    const [blastType, setBlastType] = useState<BlastType>('vaccine');
    const [inputText, setInputText] = useState('');
    const [records, setRecords] = useState<PetVilleRecord[]>([]);
    const [status, setStatus] = useState('Aguardando dados…');
    const [isSending, setIsSending] = useState(false);
    const [campaignName, setCampaignName] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [campaignRecords, setCampaignRecords] = useState<any[]>([]);
    const [webhookResponse, setWebhookResponse] = useState<{
        success: boolean;
        message: string;
        data?: any;
    } | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
    const [loadingWebhook, setLoadingWebhook] = useState(true);

    // Gera nome da campanha automaticamente
    useEffect(() => {
        const now = new Date();
        const formatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        setCampaignName(`Campanha ${formatted}`);
    }, []);

    // Busca webhook configurado na empresa
    useEffect(() => {
        const loadWebhook = async () => {
            if (!userData?.companyId) {
                setLoadingWebhook(false);
                return;
            }

            try {
                const q = query(
                    collection(db, 'companies', userData.companyId, 'webhooks'),
                    where('active', '==', true),
                    where('events', 'array-contains', WebhookEvent.WHATSAPP_BLAST)
                );

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const webhookData = snapshot.docs[0].data();
                    setWebhookUrl(webhookData.url);
                } else {
                    console.warn('Nenhum webhook ativo encontrado para disparos WhatsApp');
                }
            } catch (error) {
                console.error('Erro ao carregar webhook:', error);
            } finally {
                setLoadingWebhook(false);
            }
        };

        loadWebhook();
    }, [userData?.companyId]);

    // Converte data do Excel (número serial) para Date
    const excelDateToJSDate = (serial: number): Date => {
        // Excel conta dias desde 1/1/1900, mas tem um bug que considera 1900 como ano bissexto
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
    };

    // Formata data para exibição
    const formatDate = (serial: string): string => {
        const num = parseInt(serial);
        if (isNaN(num) || num < 1) return serial;

        try {
            const date = excelDateToJSDate(num);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return serial;
        }
    };

    /** Converte um telefone BR para E.164 (+55...) */
    const toE164BR = (input: string) => {
        if (!input) return { ok: false, e164: null, reason: "vazio" };
        let d = (input + "").replace(/\D+/g, "");
        if (d.startsWith("0")) d = d.replace(/^0+/, "");
        if (d.startsWith("550")) d = d.replace(/^550+/, "55");

        if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
            return { ok: true, e164: "+" + d };
        }

        if (!d.startsWith("55")) {
            if (d.length === 11 || d.length === 10) {
                d = "55" + d;
                return { ok: true, e164: "+" + d };
            }
        }

        if (d.startsWith("055")) d = d.replace(/^0+/, "");
        if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
            return { ok: true, e164: "+" + d };
        }

        if (d.length === 11 || d.length === 10) {
            return { ok: true, e164: "+55" + d };
        }

        return { ok: false, e164: null, reason: `tamanho ${d.length} inválido` };
    };

    const splitPhones = (cell: string) => {
        if (!cell) return [];
        return cell.split(/,|;/).map(s => s.trim()).filter(Boolean);
    };

    const loadCampaignHistory = async () => {
        if (!userData?.companyId) return;

        setLoadingHistory(true);
        try {
            const q = query(
                collection(db, 'petville_campaigns'),
                where('companyId', '==', userData.companyId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const campaignsList: Campaign[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                campaignsList.push({
                    id: doc.id,
                    name: data.name,
                    tipo: data.tipo,
                    createdAt: data.createdAt.toDate(),
                    totalRecords: data.totalRecords,
                    validRecords: data.validRecords,
                    companyId: data.companyId,
                    sentBy: data.sentBy
                });
            });

            setCampaigns(campaignsList);
        } catch (error) {
            console.error('Error loading campaigns:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadCampaignRecords = async (campaignId: string) => {
        setLoadingHistory(true);
        try {
            const q = query(
                collection(db, 'petville_blasts'),
                where('campaignId', '==', campaignId),
                orderBy('sentAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const recordsList: any[] = [];

            snapshot.forEach((doc) => {
                recordsList.push({ id: doc.id, ...doc.data() });
            });

            setCampaignRecords(recordsList);
        } catch (error) {
            console.error('Error loading campaign records:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleProcess = () => {
        const text = inputText.trim();
        if (!text) {
            setStatus("Cole os dados primeiro.");
            return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
        const out: PetVilleRecord[] = [];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            let cols = rawLine.split(/\t+/);

            if (cols.length < 7) {
                const maybe = rawLine.split(/\s{2,}/);
                if (maybe.length >= 7) {
                    cols = maybe;
                }
            }

            // Ignora cabeçalho
            if (i === 0 && /data/i.test(cols[0])) continue;
            if (cols.length < 7) continue;

            const [DataOriginal, Cliente, CodCliente, Telefones, Animal, CodAnimal, Produto] =
                cols.slice(0, 7).map(s => (s ?? "").toString().trim());

            const DataConvertida = formatDate(DataOriginal);
            const phones = splitPhones(Telefones);

            if (phones.length === 0) {
                out.push({
                    DataOriginal, DataConvertida, Cliente, CodCliente,
                    TelefoneOriginal: "", TelefoneE164: null,
                    Animal, CodAnimal, Produto, valid: false, note: "sem telefone"
                });
                continue;
            }

            for (const p of phones) {
                const norm = toE164BR(p);
                out.push({
                    DataOriginal, DataConvertida, Cliente, CodCliente,
                    TelefoneOriginal: p, TelefoneE164: norm.e164,
                    Animal, CodAnimal, Produto, valid: norm.ok,
                    note: norm.ok ? "ok" : norm.reason
                });
            }
        }

        setRecords(out);
        setStatus(`Processado com sucesso: ${out.filter(r => r.valid).length} registros válidos.`);
        setWebhookResponse(null);
    };

    const handleClear = () => {
        setInputText('');
        setRecords([]);
        setStatus("Dados limpos.");
        setWebhookResponse(null);
    };

    const buildPayload = () => {
        const valid = records.filter(r => r.valid);
        const results = valid.map(r => ({
            data_original: r.DataOriginal,
            data_convertida: r.DataConvertida,
            cliente: r.Cliente,
            codigo_cliente: r.CodCliente,
            telefone_original: r.TelefoneOriginal,
            telefone_e164: r.TelefoneE164,
            animal: r.Animal,
            codigo_animal: r.CodAnimal,
            produto: r.Produto,
            tipo: blastType
        }));
        return {
            records: results,
            total: results.length,
            tipo: blastType,
            campaign_name: campaignName,
            generated_at: new Date().toISOString()
        };
    };

    const handleDownload = () => {
        const payload = buildPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `petville_${blastType}_${campaignName.replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSend = async () => {
        const payload = buildPayload();
        const validCount = payload.records.length;

        setIsSending(true);
        setStatus("Criando campanha...");
        setWebhookResponse(null);

        try {
            if (!webhookUrl) {
                throw new Error('Nenhum webhook configurado. Configure um webhook no perfil da empresa.');
            }

            // PASSO 1: Criar campanha e registros com status "programado"
            const batch = writeBatch(db);
            const campaignRef = doc(collection(db, 'petville_campaigns'));
            const campaignId = campaignRef.id;

            batch.set(campaignRef, {
                name: campaignName,
                tipo: blastType,
                totalRecords: records.length,
                validRecords: validCount,
                status: 'programado', // Status inicial
                companyId: userData?.companyId || 'unknown',
                companyName: userData?.companyName || 'unknown',
                sentBy: userData?.displayName || userData?.email || 'unknown',
                createdAt: Timestamp.now()
            });

            // Criar registros individuais com status "programado"
            const recordsWithIds: any[] = [];
            payload.records.forEach((r: any) => {
                const logRef = doc(collection(db, 'petville_blasts'));
                const recordData = {
                    ...r,
                    campaignId,
                    campaignName,
                    tipo: blastType,
                    status: 'programado', // Status inicial
                    companyId: userData?.companyId || 'unknown',
                    companyName: userData?.companyName || 'unknown',
                    sentBy: userData?.displayName || userData?.email || 'unknown',
                    sentAt: Timestamp.now()
                };
                batch.set(logRef, recordData);
                recordsWithIds.push({
                    ...r,
                    recordId: logRef.id // ID do registro para o N8N atualizar depois
                });
            });

            await batch.commit();
            console.log('✅ Campanha criada:', campaignId);

            // PASSO 2: Enviar para webhook com campaignId e recordIds
            setStatus("Enviando para o webhook…");

            const webhookPayload = {
                ...payload,
                campaignId, // ID da campanha para rastreamento
                records: recordsWithIds, // Registros com IDs para atualização
                companyId: userData?.companyId,
                callbackUrl: `${window.location.origin}/api/petville-webhook-callback` // URL para receber retorno
            };

            console.log('📤 Enviando para webhook:', webhookUrl);
            console.log('📦 Payload:', webhookPayload);

            let res;
            try {
                res = await fetch(webhookUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(webhookPayload),
                    mode: 'cors' // Explicitamente define modo CORS
                });
            } catch (fetchError: any) {
                console.error('❌ Erro no fetch:', fetchError);
                throw new Error(`Erro de conexão: ${fetchError.message}. Verifique se a URL do webhook está correta e acessível.`);
            }

            console.log('📥 Resposta recebida - Status:', res.status);

            let responseData = null;
            try {
                responseData = await res.json();
            } catch (jsonError) {
                console.warn('⚠️ Resposta não é JSON válido');
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${responseData?.message || 'Erro desconhecido'}. Verifique a configuração do webhook no N8N.`);
            }

            console.log('✅ Webhook processado com sucesso:', responseData);

            setStatus("Disparo programado com sucesso!");
            setWebhookResponse({
                success: true,
                message: responseData?.message || "Webhook processado com sucesso. Aguardando retorno individual...",
                data: responseData
            });

            // Atualiza nome da campanha para próximo envio
            const now = new Date();
            const formatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
            setCampaignName(`Campanha ${formatted}`);

        } catch (err: any) {
            console.error(err);
            setStatus("Erro ao enviar disparos.");
            setWebhookResponse({
                success: false,
                message: err.message || "Erro ao conectar com o webhook",
                data: null
            });
        } finally {
            setIsSending(false);
        }
    };

    const validCount = records.filter(r => r.valid).length;
    const invalidCount = records.length - validCount;

    if (showHistory) {
        return (
            <div className="fade-in module-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 className="title" style={{ marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <History size={28} color="var(--primary-color)" />
                            Histórico de Campanhas
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {selectedCampaign ? `Visualizando: ${selectedCampaign.name}` : 'Todas as campanhas enviadas'}
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setShowHistory(false);
                            setSelectedCampaign(null);
                            setCampaignRecords([]);
                        }}
                    >
                        Voltar
                    </button>
                </div>

                {!selectedCampaign ? (
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        {loadingHistory ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>
                                <Loader2 className="loading-spinner" style={{ margin: '0 auto' }} />
                                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando campanhas...</p>
                            </div>
                        ) : campaigns.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                <p>Nenhuma campanha encontrada.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {campaigns.map((campaign) => (
                                    <div
                                        key={campaign.id}
                                        className="glass-card"
                                        style={{
                                            padding: '1.2rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onClick={() => {
                                            setSelectedCampaign(campaign);
                                            loadCampaignRecords(campaign.id);
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                {campaign.tipo === 'vaccine' ? (
                                                    <Syringe size={20} color="#4318FF" />
                                                ) : (
                                                    <Shield size={20} color="#4318FF" />
                                                )}
                                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                                                    {campaign.name}
                                                </h3>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: campaign.tipo === 'vaccine' ? 'rgba(67, 24, 255, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                    color: campaign.tipo === 'vaccine' ? '#4318FF' : '#10b981'
                                                }}>
                                                    {campaign.tipo === 'vaccine' ? 'Vacina' : 'Antiparasitário'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <div>📅 {campaign.createdAt.toLocaleDateString('pt-BR')} às {campaign.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div>📊 {campaign.validRecords} registros válidos de {campaign.totalRecords} total</div>
                                                <div>👤 Enviado por: {campaign.sentBy}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={24} color="var(--text-secondary)" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(67, 24, 255, 0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                {selectedCampaign.tipo === 'vaccine' ? (
                                    <Syringe size={24} color="#4318FF" />
                                ) : (
                                    <Shield size={24} color="#4318FF" />
                                )}
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                                    {selectedCampaign.name}
                                </h3>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Total de {campaignRecords.length} registros enviados
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-color)', zIndex: 1 }}>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Data</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Cliente</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Telefone</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Animal</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Produto</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaignRecords.map((record, i) => (
                                        <tr key={record.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '12px 16px' }}>{record.data_convertida}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600 }}>{record.cliente}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cód: {record.codigo_cliente}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#16a34a' }}>
                                                {record.telefone_e164}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600 }}>{record.animal}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cód: {record.codigo_animal}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(67, 24, 255, 0.1)',
                                                    color: '#4318FF'
                                                }}>
                                                    {record.produto}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {record.status === 'success' ? (
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(22, 163, 74, 0.1)',
                                                        color: '#16a34a',
                                                        fontWeight: 600
                                                    }}>
                                                        ✓ Enviado
                                                    </span>
                                                ) : record.status === 'failed' ? (
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#ef4444',
                                                        fontWeight: 600
                                                    }} title={record.error || 'Erro desconhecido'}>
                                                        ✗ Falhou
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(245, 158, 11, 0.1)',
                                                        color: '#f59e0b',
                                                        fontWeight: 600
                                                    }}>
                                                        ⏳ Programado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
                }
            </div >
        );
    }

    return (
        <div className="fade-in module-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Smartphone size={28} color="var(--primary-color)" />
                        Disparos PetVille
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{status}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setShowHistory(true);
                            loadCampaignHistory();
                        }}
                    >
                        <History size={18} /> Histórico
                    </button>
                    {records.length > 0 && (
                        <>
                            <button className="btn btn-secondary" onClick={handleDownload} title="Baixar JSON">
                                <Download size={18} /> Baixar JSON
                            </button>
                            <button className="btn btn-primary" onClick={handleSend} disabled={validCount === 0 || isSending || !webhookUrl}>
                                {isSending ? <Loader2 className="loading-spinner" /> : <Send size={18} />}
                                Disparar no WhatsApp
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Webhook Not Configured Alert */}
            {!loadingWebhook && !webhookUrl && (
                <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    border: '2px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.05)',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '12px'
                }}>
                    <AlertCircle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: '#f59e0b',
                            marginBottom: '6px'
                        }}>
                            ⚠️ Webhook não configurado
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Configure um webhook no perfil da empresa com o evento "Disparo WhatsApp (PetVille)" ativo para poder enviar disparos.
                        </div>
                    </div>
                </div>
            )}

            {/* Webhook URL Debug Info */}
            {!loadingWebhook && webhookUrl && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(67, 24, 255, 0.2)',
                    background: 'rgba(67, 24, 255, 0.03)',
                    fontSize: '0.8rem'
                }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--primary-color)' }}>
                        🔗 Webhook Configurado
                    </div>
                    <code style={{
                        background: 'rgba(0,0,0,0.05)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        display: 'block'
                    }}>
                        {webhookUrl}
                    </code>
                </div>
            )}

            {/* Webhook Response Alert */}
            {webhookResponse && (
                <div style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    border: `2px solid ${webhookResponse.success ? '#16a34a' : '#ef4444'}`,
                    background: webhookResponse.success ? 'rgba(22, 163, 74, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '12px'
                }}>
                    {webhookResponse.success ? (
                        <CheckCircle2 size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                        <XCircle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: webhookResponse.success ? '#16a34a' : '#ef4444',
                            marginBottom: '6px'
                        }}>
                            {webhookResponse.success ? '✓ Webhook Executado com Sucesso' : '✗ Falha no Webhook'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            {webhookResponse.message}
                        </div>
                        {webhookResponse.data && (
                            <details style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary-color)' }}>
                                    Ver resposta completa do N8N
                                </summary>
                                <pre style={{
                                    background: 'rgba(0,0,0,0.05)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginTop: '8px',
                                    overflow: 'auto',
                                    maxHeight: '200px',
                                    fontSize: '0.7rem'
                                }}>
                                    {JSON.stringify(webhookResponse.data, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem', height: '100%', alignItems: 'start' }}>

                {/* Entrada Panel */}
                <div className="glass-card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

                    {/* Nome da Campanha */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={16} />
                            Nome da Campanha
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            placeholder="Ex: Campanha 09-02-2026"
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Tipo de Disparo */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'block' }}>
                            Tipo de Disparo
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setBlastType('vaccine')}
                                style={{
                                    flex: 1,
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: blastType === 'vaccine' ? '2px solid #4318FF' : '2px solid var(--border-color)',
                                    background: blastType === 'vaccine' ? 'rgba(67, 24, 255, 0.05)' : 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Syringe size={28} color={blastType === 'vaccine' ? '#4318FF' : '#94a3b8'} />
                                <span style={{
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    color: blastType === 'vaccine' ? '#4318FF' : '#64748b'
                                }}>
                                    Vacina
                                </span>
                            </button>

                            <button
                                onClick={() => setBlastType('antiparasitic')}
                                style={{
                                    flex: 1,
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: blastType === 'antiparasitic' ? '2px solid #4318FF' : '2px solid var(--border-color)',
                                    background: blastType === 'antiparasitic' ? 'rgba(67, 24, 255, 0.05)' : 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Shield size={28} color={blastType === 'antiparasitic' ? '#4318FF' : '#94a3b8'} />
                                <span style={{
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    color: blastType === 'antiparasitic' ? '#4318FF' : '#64748b'
                                }}>
                                    Antiparasitário
                                </span>
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
                        <Clipboard size={22} color="var(--primary-color)" />
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Dados da Planilha</h2>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Cole aqui as colunas (Data, Cliente, Cód. Cliente, Telefones, Animal, Cód. Animal, {blastType === 'vaccine' ? 'Vacina' : 'Antiparasitário'})
                    </p>

                    <textarea
                        className="form-input"
                        style={{
                            flex: 1,
                            minHeight: '250px',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            lineHeight: '1.5',
                            padding: '1rem',
                            resize: 'none'
                        }}
                        placeholder={`Ex: 46062\tWanda Sousa\t417\t(91) 98112-8051, (91) 98112-8490\tHelen\t2446\t${blastType === 'vaccine' ? 'Nexguard Spectra' : 'Bravecto'}`}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleProcess}>
                            Processar Dados
                        </button>
                        <button className="btn btn-secondary" onClick={handleClear}>
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(67, 24, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(67, 24, 255, 0.1)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <Info size={16} color="var(--primary-color)" />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Dicas de Formatação</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <li>Cole direto do Excel ou Google Sheets (TAB entre colunas).</li>
                            <li>Data no formato Excel (ex: 46062) será convertida automaticamente.</li>
                            <li>Múltiplos telefones separados por vírgula ou ponto e vírgula.</li>
                            <li>Cada telefone gera uma linha separada no disparo.</li>
                            <li>Números convertidos automaticamente para formato E.164 (+55...).</li>
                        </ul>
                    </div>
                </div>

                {/* Preview Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Stats */}
                    {records.length > 0 && (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="glass-card" style={{ flex: 1, padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{records.length}</div>
                            </div>
                            <div className="glass-card" style={{ flex: 1, padding: '1rem', textAlign: 'center', borderLeft: '4px solid #16a34a' }}>
                                <div style={{ fontSize: '0.75rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Válidos</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{validCount}</div>
                            </div>
                            <div className="glass-card" style={{ flex: 1, padding: '1rem', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
                                <div style={{ fontSize: '0.75rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Falhas</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{invalidCount}</div>
                            </div>
                        </div>
                    )}

                    {/* Table View */}
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
                        <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={20} color="var(--primary-color)" />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Prévia dos Registros</h3>
                        </div>

                        <div style={{ overflowX: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>#</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Data</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Cliente</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Telefone</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>E.164</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Animal/Produto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length > 0 ? (
                                        records.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: r.valid ? 'transparent' : 'rgba(239, 68, 68, 0.03)' }}>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#4318FF' }}>{r.DataConvertida}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: 600 }}>{r.Cliente}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cód: {r.CodCliente}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{r.TelefoneOriginal}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {r.valid ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                                                            <CheckCircle2 size={14} /> {r.TelefoneE164}
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 600 }}>
                                                            <AlertCircle size={14} /> {r.note}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Smartphone size={14} /> {r.Animal}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: 'rgba(67, 24, 255, 0.1)', color: 'var(--primary-color)', marginTop: '4px' }}>
                                                        {r.Produto}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Nenhum dado processado. Cole as informações na esquerda para começar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .module-container { 
                    display: flex; 
                    flex-direction: column; 
                    height: calc(100vh - 120px); 
                    overflow-y: auto;
                    padding-right: 5px;
                }
                @media (max-width: 991px) {
                    .module-container { height: auto; }
                }
            `}</style>
        </div>
    );
};

export default PetVilleBlastsModule;
