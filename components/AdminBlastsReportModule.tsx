
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, orderBy, limit, getDocs, where, startAfter, Timestamp } from 'firebase/firestore';
import {
    Search,
    Calendar,
    User,
    Smartphone,
    Syringe,
    Shield,
    Building2,
    Download,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Clock
} from 'lucide-react';

interface BlastLog {
    id: string;
    data: string;
    cliente: string;
    codigo_cliente?: string;
    telefone_original: string;
    telefone_e164: string;
    animal: string;
    codigo_animal?: string;
    vacina?: string;
    antiparasitario?: string;
    aplicacao: string;
    type: 'vaccine' | 'parasitic';
    companyId: string;
    companyName: string;
    sentBy: string;
    sentAt: Timestamp;
}

const AdminBlastsReportModule = () => {
    const [logs, setLogs] = useState<BlastLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'vaccine' | 'parasitic'>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [firstDoc, setFirstDoc] = useState<any>(null);
    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        fetchLogs();
    }, [filterType, searchTerm]); // Reset and fetch on filter/search change

    const fetchLogs = async (direction?: 'next' | 'prev') => {
        setLoading(true);
        try {
            let q = query(
                collection(db, 'blasts_logs'),
                orderBy('sentAt', 'desc'),
                limit(ITEMS_PER_PAGE)
            );

            if (filterType !== 'all') {
                q = query(q, where('type', '==', filterType));
            }

            // Simple search filter (in client if results are few, or we can use more complex queries if needed)
            // For now, let's stick to a basic list and apply search filters client-side due to Firestore limitations with multiple filters + order

            const snap = await getDocs(q);
            const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlastLog));

            let filteredResults = results;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredResults = results.filter(log =>
                    log.cliente.toLowerCase().includes(term) ||
                    log.animal.toLowerCase().includes(term) ||
                    log.companyName.toLowerCase().includes(term) ||
                    log.telefone_e164.includes(term)
                );
            }

            setLogs(filteredResults);
            setFirstDoc(snap.docs[0]);
            setLastDoc(snap.docs[snap.docs.length - 1]);
        } catch (error) {
            console.error("Error fetching blast logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (ts: Timestamp) => {
        if (!ts) return '-';
        return ts.toDate().toLocaleString('pt-BR');
    };

    const handleExport = () => {
        const csvContent = [
            ["Data Envio", "Tipo", "Empresa", "Cliente", "Animal", "Produto", "Aplicação", "Telefone", "Enviado Por"],
            ...logs.map(l => [
                formatDate(l.sentAt),
                l.type === 'vaccine' ? 'Vacina' : 'Antiparasitário',
                l.companyName,
                l.cliente,
                l.animal,
                l.vacina || l.antiparasitario || '-',
                l.aplicacao,
                l.telefone_e164,
                l.sentBy
            ])
        ].map(e => e.join(",")).join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_disparos_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title">Relatórios de Disparos</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Histórico de disparos de Vacinas e Antiparasitários</p>
                </div>
                <button className="btn btn-secondary" onClick={handleExport} disabled={logs.length === 0}>
                    <Download size={18} /> Exportar CSV
                </button>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: '2.5rem' }}
                            placeholder="Buscar por cliente, animal, empresa ou telefone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            className={`btn ${filterType === 'all' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: filterType === 'all' ? 'var(--primary-color)' : 'transparent', color: filterType === 'all' ? 'white' : 'var(--text-secondary)', border: 'none' }}
                            onClick={() => setFilterType('all')}
                        >
                            Todos
                        </button>
                        <button
                            className={`btn ${filterType === 'vaccine' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: filterType === 'vaccine' ? 'var(--primary-color)' : 'transparent', color: filterType === 'vaccine' ? 'white' : 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setFilterType('vaccine')}
                        >
                            <Syringe size={14} /> Vacinas
                        </button>
                        <button
                            className={`btn ${filterType === 'parasitic' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: filterType === 'parasitic' ? 'var(--primary-color)' : 'transparent', color: filterType === 'parasitic' ? 'white' : 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setFilterType('parasitic')}
                        >
                            <Shield size={14} /> Antiparasitários
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <Loader2 className="loading-spinner" size={40} />
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Carregando relatórios...</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Data Envio</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Empresa / Usuário</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Cliente / Telefone</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Animal / Item</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Tipo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                                            <Calendar size={14} color="var(--primary-color)" />
                                            {formatDate(log.sentAt)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                            <Building2 size={14} color="var(--text-muted)" />
                                            {log.companyName}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '20px' }}>
                                            por {log.sentBy}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                            <User size={14} color="var(--text-muted)" />
                                            {log.cliente}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginLeft: '20px', fontFamily: 'monospace' }}>
                                            {log.telefone_e164}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600 }}>{log.animal}</div>
                                        <div style={{ fontSize: '0.75rem', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: 'rgba(67, 24, 255, 0.1)', color: 'var(--primary-color)', marginTop: '4px' }}>
                                            {log.vacina || log.antiparasitario} - {log.aplicacao}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '4px 10px',
                                            borderRadius: '99px',
                                            width: 'fit-content',
                                            background: log.type === 'vaccine' ? 'rgba(5, 205, 153, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                                            color: log.type === 'vaccine' ? '#16a34a' : '#0284c7'
                                        }}>
                                            {log.type === 'vaccine' ? <Syringe size={12} /> : <Shield size={12} />}
                                            {log.type === 'vaccine' ? 'VACINA' : 'ANTI-P'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Nenhum disparo registrado ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default AdminBlastsReportModule;
