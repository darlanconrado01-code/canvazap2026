
import React, { useState } from 'react';
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
    XCircle
} from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';

interface VaccineRecord {
    Data: string;
    Cliente: string;
    CodCliente: string;
    TelefoneOriginal: string;
    TelefoneE164: string | null;
    Animal: string;
    CodAnimal: string;
    Vacina: string;
    Aplicacao: string;
    valid: boolean;
    note: string;
}

const VaccineBlastsModule = () => {
    const { userData } = useAuth();
    const [inputText, setInputText] = useState('');
    const [records, setRecords] = useState<VaccineRecord[]>([]);
    const [status, setStatus] = useState('Aguardando dados…');
    const [isSending, setIsSending] = useState(false);
    const [webhookResponse, setWebhookResponse] = useState<{
        success: boolean;
        message: string;
        data?: any;
    } | null>(null);

    const webhookURL = "https://n8n-n8n.w2dtoj.easypanel.host/webhook/f619572c-766b-4ff4-87a9-fa78a79767fc";

    /** Converte um telefone BR para E.164 (+55...) */
    const toE164BR = (input: string) => {
        if (!input) return { ok: false, e164: null, reason: "vazio" };
        let d = (input + "").replace(/\D+/g, "");           // só dígitos
        if (d.startsWith("0")) d = d.replace(/^0+/, "");  // remove zeros à esquerda

        // normalizações comuns
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

    const handleProcess = () => {
        const text = inputText.trim();
        if (!text) {
            setStatus("Cole os dados primeiro.");
            return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
        const out: VaccineRecord[] = [];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            let cols = rawLine.split(/\t+/); // TABs

            if (cols.length < 8) {
                const maybe = rawLine.split(/\s{2,}/);
                if (maybe.length >= 8) {
                    cols = maybe;
                }
            }

            // Ignora cabeçalho
            if (i === 0 && /data/i.test(cols[0])) continue;
            if (cols.length < 8) continue;

            const [Data, Cliente, CodCliente, Telefones, Animal, CodAnimal, Vacina, Aplicacao] =
                cols.slice(0, 8).map(s => (s ?? "").toString().trim());

            const phones = splitPhones(Telefones);
            if (phones.length === 0) {
                out.push({
                    Data, Cliente, CodCliente, TelefoneOriginal: "", TelefoneE164: null,
                    Animal, CodAnimal, Vacina, Aplicacao, valid: false, note: "sem telefone"
                });
                continue;
            }

            for (const p of phones) {
                const norm = toE164BR(p);
                out.push({
                    Data, Cliente, CodCliente, TelefoneOriginal: p, TelefoneE164: norm.e164,
                    Animal, CodAnimal, Vacina, Aplicacao, valid: norm.ok, note: norm.ok ? "ok" : norm.reason
                });
            }
        }

        setRecords(out);
        setStatus("Processado com sucesso.");
        setWebhookResponse(null); // Limpa resposta anterior
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
            data: r.Data,
            cliente: r.Cliente,
            codigo_cliente: r.CodCliente,
            telefone_original: r.TelefoneOriginal,
            telefone_e164: r.TelefoneE164,
            animal: r.Animal,
            codigo_animal: r.CodAnimal,
            vacina: r.Vacina,
            aplicacao: r.Aplicacao
        }));
        return { records: results, total: results.length, generated_at: new Date().toISOString() };
    };

    const handleDownload = () => {
        const payload = buildPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `disparo_vacinas_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSend = async () => {
        const payload = buildPayload();
        setIsSending(true);
        setStatus("Enviando para o webhook…");
        setWebhookResponse(null);

        try {
            const res = await fetch(webhookURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const responseData = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${responseData?.message || 'Erro desconhecido'}`);
            }

            // Log to Firestore
            try {
                const batch = writeBatch(db);
                const results = payload.records;
                results.forEach((r: any) => {
                    const logRef = doc(collection(db, 'blasts_logs'));
                    batch.set(logRef, {
                        ...r,
                        type: 'vaccine',
                        companyId: userData?.companyId || 'unknown',
                        companyName: userData?.companyName || 'unknown',
                        sentBy: userData?.displayName || userData?.email || 'unknown',
                        sentAt: new Date()
                    });
                });
                await batch.commit();
            } catch (logErr) {
                console.error("Error logging blasts:", logErr);
            }

            setStatus("Disparo efetuado com sucesso!");
            setWebhookResponse({
                success: true,
                message: responseData?.message || "Webhook processado com sucesso",
                data: responseData
            });
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

    return (
        <div className="fade-in module-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.2rem' }}>Processar Planilha de Vacinações</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{status}</p>
                </div>
                {records.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={handleDownload} title="Baixar JSON">
                            <Download size={18} /> Baixar JSON
                        </button>
                        <button className="btn btn-primary" onClick={handleSend} disabled={validCount === 0 || isSending}>
                            {isSending ? <Loader2 className="loading-spinner" /> : <Send size={18} />}
                            Disparar no Webhook
                        </button>
                    </div>
                )}
            </div>

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
                        <Clipboard size={22} color="var(--primary-color)" />
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Dados da Planilha</h2>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Cole aqui as colunas (Data, Cliente, Cód., Tel., Animal, Cód. Animal, Vacina, Aplicação)
                    </p>

                    <textarea
                        className="form-input"
                        style={{
                            flex: 1,
                            minHeight: '350px',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            lineHeight: '1.5',
                            padding: '1rem',
                            resize: 'none'
                        }}
                        placeholder="Ex: 25/01/2026	João Silva	123	(91) 98888-7777	Rex	456	V10	1ª Dose"
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
                            <li>Cole direto do Excel ou Google Sheets (ele usa TAB automaticamente).</li>
                            <li>Múltiplos telefones podem ser separados por vírgula ou ponto e vírgula.</li>
                            <li>O sistema converterá todos os números para o formato internacional (+55...).</li>
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
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Cliente</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Telefone</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>E.164</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold' }}>Animal/Vacina</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length > 0 ? (
                                        records.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: r.valid ? 'transparent' : 'rgba(239, 68, 68, 0.03)' }}>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{i + 1}</td>
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
                                                        {r.Vacina} - {r.Aplicacao}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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

export default VaccineBlastsModule;
