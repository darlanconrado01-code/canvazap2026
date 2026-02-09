
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Clipboard, Check, Search, Filter, Database, Trash2, Play, Loader2, Plus, LayoutList, PieChart } from 'lucide-react';

interface BadgeCycle {
    id: string;
    name: string; // e.g., "Leva Janeiro 2026 - Motoristas"
    totalQuantity: number;
    usedQuantity: number; // Computed locally or via counters
    category: string; // e.g., "Motoristas", "Geral"
    status: 'active' | 'completed' | 'archived';
    createdAt: any;
    companyId: string;
    companyName: string;
}

interface BadgeRequest {
    id: string;
    originalDate: string;
    matricula: string;
    name: string;
    department: string;
    status: string;
    createdAt: any;
    companyId: string;
    companyName: string;
    requesterId: string;
    requesterName: string;
    cycleId?: string; // Optional (legacy support)
    cycleName?: string;
}

const BadgeManagementModule = () => {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'list' | 'import' | 'cycles'>('list');

    // Import State
    const [inputText, setInputText] = useState('');
    const [parsedData, setParsedData] = useState<Partial<BadgeRequest>[]>([]);
    const [selectedImportCycle, setSelectedImportCycle] = useState<string>('');

    // Data State
    const [badges, setBadges] = useState<BadgeRequest[]>([]);
    const [cycles, setCycles] = useState<BadgeCycle[]>([]);

    // Filters & UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [cycleFilter, setCycleFilter] = useState('Todos');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // New Cycle Form
    const [showNewCycleForm, setShowNewCycleForm] = useState(false);
    const [newCycleData, setNewCycleData] = useState({ name: '', quantity: 0, category: 'Geral' });
    const [companyForCycle, setCompanyForCycle] = useState<{ id: string, name: string } | null>(null);

    const isSuperAdmin = userData?.role === 'super_admin';

    // Fetch Companies for Admin Cycle Creation (Simplified: fetching all distinct companies from badges or just current if not admin)
    // Actually, distinct companies might be hard. For now, let's assume Admin creates cycle for specific company manually or we list all companies.
    // To keep it simple: Admin creates cycle, inputs Company ID? Or we infer?
    // Let's implement a simple "Select Company" if Super Admin. For this demo, we might need to fetch companies collection.
    const [companiesList, setCompaniesList] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        if (userData) {
            fetchCycles();
            fetchBadges();
            if (isSuperAdmin) {
                fetchCompanies();
            }
        }
    }, [userData, isSuperAdmin]);

    // Recalculate used quantities when badges change
    useEffect(() => {
        if (cycles.length > 0 && badges.length > 0) {
            const usageMap = new Map<string, number>();
            badges.forEach(b => {
                if (b.cycleId) {
                    usageMap.set(b.cycleId, (usageMap.get(b.cycleId) || 0) + 1);
                }
            });

            // Note: This is a client-side calculation for display. 
            // In a robust system, we might update the cycle document transactionally.
            setCycles(prev => prev.map(c => ({
                ...c,
                usedQuantity: usageMap.get(c.id) || 0
            })));
        }
    }, [badges.length]); // Only recompute when badges count changes to avoid simple loops. 

    const fetchCompanies = async () => {
        // Fetch a few companies for the dropdown
        try {
            const q = query(collection(db, 'companies'), orderBy('name'), where('status', '==', 'active'));
            const snap = await getDocs(q);
            setCompaniesList(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
        } catch (e) {
            console.error(e);
        }
    }

    const fetchCycles = async () => {
        try {
            const collectionRef = collection(db, 'badge_cycles');
            let q;
            if (isSuperAdmin) {
                q = query(collectionRef, orderBy('createdAt', 'desc'));
            } else {
                if (!userData?.companyId) return;
                q = query(collectionRef, where('companyId', '==', userData.companyId), orderBy('createdAt', 'desc'));
            }
            const snap = await getDocs(q);
            setCycles(snap.docs.map(d => ({ id: d.id, ...d.data() } as BadgeCycle)));
        } catch (error) {
            console.error("Error fetching cycles:", error);
        }
    };

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const collectionRef = collection(db, 'badge_requests');
            let q;

            if (isSuperAdmin) {
                q = query(collectionRef, orderBy('createdAt', 'desc'));
            } else {
                if (!userData?.companyId) {
                    setBadges([]);
                    setLoading(false);
                    return;
                }
                q = query(
                    collectionRef,
                    where('companyId', '==', userData.companyId),
                    orderBy('createdAt', 'desc')
                );
            }

            const snapshot = await getDocs(q);
            const fetchedBytes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as BadgeRequest));

            setBadges(fetchedBytes);
        } catch (error) {
            console.error("Error fetching badges:", error);
            try {
                const simpleQ = isSuperAdmin
                    ? query(collection(db, 'badge_requests'))
                    : query(collection(db, 'badge_requests'), where('companyId', '==', userData?.companyId));

                const snap = await getDocs(simpleQ);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BadgeRequest));
                data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setBadges(data);
            } catch (e) { console.error(e); }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCycle = async () => {
        if (!newCycleData.name || newCycleData.quantity <= 0) {
            alert("Preencha o nome e a quantidade.");
            return;
        }

        const targetCompanyId = isSuperAdmin ? companyForCycle?.id : userData?.companyId;
        const targetCompanyName = isSuperAdmin ? companyForCycle?.name : userData?.companyName;

        if (!targetCompanyId) {
            alert("Empresa não selecionada.");
            return;
        }

        try {
            await addDoc(collection(db, 'badge_cycles'), {
                name: newCycleData.name,
                totalQuantity: Number(newCycleData.quantity),
                usedQuantity: 0,
                category: newCycleData.category,
                status: 'active',
                createdAt: serverTimestamp(),
                companyId: targetCompanyId,
                companyName: targetCompanyName
            });
            setShowNewCycleForm(false);
            setNewCycleData({ name: '', quantity: 0, category: 'Geral' });
            fetchCycles();
            alert("Ciclo criado com sucesso!");
        } catch (error) {
            console.error("Error creating cycle:", error);
            alert("Erro ao criar ciclo.");
        }
    };

    const handleParse = () => {
        if (!inputText.trim()) return;

        const lines = inputText.trim().split('\n');
        const newBadges: Partial<BadgeRequest>[] = [];

        lines.forEach((line) => {
            const parts = line.split(/\t/);
            // Skip header
            if (parts[0]?.toLowerCase().includes('data') && parts[1]?.toLowerCase().includes('matr')) return;

            if (parts.length >= 3) {
                newBadges.push({
                    originalDate: parts[0]?.trim(),
                    matricula: parts[1]?.trim(),
                    name: parts[2]?.trim(),
                    department: parts[3]?.trim() || '',
                    status: parts[4]?.trim() || 'Pendente',
                });
            }
        });

        if (newBadges.length === 0) {
            alert("Nenhum dado válido encontrado.");
            return;
        }

        setParsedData(newBadges);
    };

    const confirmImport = async () => {
        const targetCompanyId = userData?.companyId;

        if (!targetCompanyId && !isSuperAdmin) {
            alert("Erro: Empresa não identificada.");
            return;
        }

        // If super admin, they must select a cycle which dictates the company
        if (isSuperAdmin && !selectedImportCycle) {
            alert("Selecione um ciclo para vincular estes pedidos.");
            return;
        }

        let finalCompanyId = targetCompanyId;
        let finalCompanyName = userData?.companyName;
        let cycleName = '';

        if (selectedImportCycle) {
            const cycle = cycles.find(c => c.id === selectedImportCycle);
            if (cycle) {
                finalCompanyId = cycle.companyId;
                finalCompanyName = cycle.companyName;
                cycleName = cycle.name;
            }
        }

        setSubmitting(true);
        try {
            const batchPromises = parsedData.map(item => {
                return addDoc(collection(db, 'badge_requests'), {
                    ...item,
                    companyId: finalCompanyId || 'ADMIN_GLOBAL',
                    companyName: finalCompanyName || 'Administração',
                    requesterId: userData?.uid,
                    requesterName: userData?.name || userData?.email,
                    createdAt: serverTimestamp(),
                    status: item.status || 'Pendente',
                    cycleId: selectedImportCycle || null,
                    cycleName: cycleName || null
                });
            });

            await Promise.all(batchPromises);

            setParsedData([]);
            setInputText('');
            setActiveTab('list');
            fetchBadges();
            alert(`${parsedData.length} solicitações enviadas com sucesso!`);
        } catch (error) {
            console.error("Error submitting:", error);
            alert("Erro ao salvar solicitações.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            await deleteDoc(doc(db, 'badge_requests', id));
            setBadges(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    // Simplified status updater
    const handleStatusChange = async (id: string, newStatus: string) => {
        setBadges(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        try {
            await updateDoc(doc(db, 'badge_requests', id), { status: newStatus });
        } catch (error) {
            console.error(error);
        }
    };

    const uniqueStatuses = ['Todos', ...Array.from(new Set(badges.map(b => b.status || 'Pendente')))];

    // Filter Cycles based on user role
    const visibleCycles = cycles; // Already filtered in fetch
    const uniqueCycles = ['Todos', ...Array.from(new Set(visibleCycles.map(c => c.name)))];

    const filteredBadges = badges.filter(b => {
        const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.matricula || '').includes(searchTerm) ||
            (b.companyName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'Todos' || b.status === statusFilter;
        const matchesCycle = cycleFilter === 'Todos' || b.cycleName === cycleFilter;
        return matchesSearch && matchesStatus && matchesCycle;
    });

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s.includes('entregue')) return 'bg-green-100 text-green-800 border-green-200';
        if (s.includes('pendente')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if (s.includes('produção') || s.includes('producao')) return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    return (
        <div className="fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Crachás</h1>
                    <p className="text-gray-500">
                        {isSuperAdmin ? 'Administração de Pedidos e Ciclos' : 'Meus Pedidos de Crachás'}
                    </p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <LayoutList size={16} /> Lista
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveTab('cycles')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'cycles' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <PieChart size={16} /> Ciclos
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('import')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'import' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Clipboard size={16} /> Importar
                    </button>
                </div>
            </div>

            {/* --- CYCLES TAB --- */}
            {activeTab === 'cycles' && isSuperAdmin && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Contratos e Ciclos de Produção</h2>
                        <button onClick={() => setShowNewCycleForm(!showNewCycleForm)} className="btn btn-primary flex items-center gap-2">
                            <Plus size={18} /> Novo Ciclo
                        </button>
                    </div>

                    {showNewCycleForm && (
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-4">
                            <h3 className="font-semibold text-indigo-900 mb-4">Adicionar Novo Ciclo/Leva</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-indigo-800 mb-1">Empresa</label>
                                    <select
                                        className="w-full p-2 border border-indigo-200 rounded"
                                        onChange={(e) => {
                                            const comp = companiesList.find(c => c.id === e.target.value);
                                            setCompanyForCycle(comp || null);
                                        }}
                                    >
                                        <option value="">Selecione...</option>
                                        {companiesList.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-indigo-800 mb-1">Nome do Ciclo</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-indigo-200 rounded"
                                        placeholder="Ex: Leva Jan/26 - Motoristas"
                                        value={newCycleData.name}
                                        onChange={e => setNewCycleData({ ...newCycleData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-indigo-800 mb-1">Qtd. Contratada</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-indigo-200 rounded"
                                        value={newCycleData.quantity}
                                        onChange={e => setNewCycleData({ ...newCycleData, quantity: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-indigo-800 mb-1">Categoria</label>
                                    <select
                                        className="w-full p-2 border border-indigo-200 rounded"
                                        value={newCycleData.category}
                                        onChange={e => setNewCycleData({ ...newCycleData, category: e.target.value })}
                                    >
                                        <option value="Geral">Geral</option>
                                        <option value="Motoristas">Motoristas</option>
                                        <option value="Administrativo">Administrativo</option>
                                        <option value="Operacional">Operacional</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowNewCycleForm(false)} className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700">Cancelar</button>
                                <button onClick={handleCreateCycle} className="px-4 py-2 bg-indigo-600 text-white rounded font-medium">Criar Ciclo</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {visibleCycles.map(cycle => {
                            const percent = Math.min((cycle.usedQuantity / cycle.totalQuantity) * 100, 100);
                            return (
                                <div key={cycle.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-gray-800">{cycle.name}</h4>
                                            <p className="text-xs text-gray-500 font-medium">{cycle.companyName} • {cycle.category}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${cycle.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {cycle.status === 'active' ? 'Ativo' : 'Concluído'}
                                        </span>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600">Utilizado: <span className="font-bold text-gray-900">{cycle.usedQuantity}</span></span>
                                            <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{cycle.totalQuantity}</span></span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-2.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-yellow-500' : 'bg-indigo-600'}`}
                                                style={{ width: `${percent}%`, transition: 'width 0.5s ease-out' }}
                                            ></div>
                                        </div>
                                        <div className="mt-2 text-right text-xs text-gray-400">
                                            Resta: {Math.max(cycle.totalQuantity - cycle.usedQuantity, 0)} unidades
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- IMPORT TAB --- */}
            {activeTab === 'import' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">1. Cole os dados (Excel)</label>
                            <textarea
                                className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                placeholder={"29/05/2025\t7650\tABEL SANTOS\tRH\tPendente..."}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <div className="mt-2 flex justify-end">
                                <button onClick={handleParse} className="btn btn-secondary text-sm">Processar Texto</button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">2. Vincular ao Ciclo/Contrato</label>
                            <p className="text-xs text-gray-500 mb-2">Selecione de qual contrato/leva essas unidades serão descontadas.</p>

                            <select
                                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 mb-4"
                                value={selectedImportCycle}
                                onChange={(e) => setSelectedImportCycle(e.target.value)}
                            >
                                <option value="">-- Selecione um Ciclo (Opcional se Cliente) --</option>
                                {visibleCycles.filter(c => c.status === 'active').map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.totalQuantity - c.usedQuantity} restantes) {isSuperAdmin ? ` - ${c.companyName}` : ''}
                                    </option>
                                ))}
                            </select>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h4 className="text-blue-900 font-semibold text-sm mb-1">Instruções</h4>
                                <ul className="text-xs text-blue-800 list-disc list-inside space-y-1">
                                    <li>Copie as colunas do Excel sem o cabeçalho.</li>
                                    <li>Ordem: Data | Matrícula | Nome | Depto | Status</li>
                                    <li>Verifique o ciclo correto para manter o controle de saldo.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {parsedData.length > 0 && (
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <Search size={18} /> Pré-visualização ({parsedData.length} itens)
                            </h3>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 mb-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 font-semibold sticky top-0">
                                        <tr>
                                            <th className="p-2">Data</th>
                                            <th className="p-2">Matrícula</th>
                                            <th className="p-2">Nome</th>
                                            <th className="p-2">Depto</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {parsedData.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-2">{item.originalDate}</td>
                                                <td className="p-2 font-mono">{item.matricula}</td>
                                                <td className="p-2">{item.name}</td>
                                                <td className="p-2">{item.department}</td>
                                                <td className="p-2">{item.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={confirmImport}
                                    disabled={submitting}
                                    className="btn btn-primary"
                                >
                                    {submitting ? <Loader2 className="animate-spin" /> : <Check size={18} />}
                                    Confirmar Importação
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- LIST TAB --- */}
            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-200px)]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="border border-gray-300 rounded-lg py-2 px-3 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            className="border border-gray-300 rounded-lg py-2 px-3 text-sm max-w-[200px]"
                            value={cycleFilter}
                            onChange={(e) => setCycleFilter(e.target.value)}
                        >
                            {uniqueCycles.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 shadow-sm z-10">
                                <tr>
                                    {isSuperAdmin && <th className="p-4 border-b">Empresa</th>}
                                    <th className="p-4 border-b">Ciclo</th>
                                    <th className="p-4 border-b">Data</th>
                                    <th className="p-4 border-b">Matrícula</th>
                                    <th className="p-4 border-b">Funcionário</th>
                                    <th className="p-4 border-b">Status</th>
                                    {isSuperAdmin && <th className="p-4 border-b text-right">Ações</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredBadges.map((badge) => (
                                    <tr key={badge.id} className="hover:bg-gray-50 group">
                                        {isSuperAdmin && <td className="p-4 font-semibold text-indigo-900">{badge.companyName}</td>}
                                        <td className="p-4 text-xs text-gray-500 max-w-[150px] truncate" title={badge.cycleName}>{badge.cycleName || '-'}</td>
                                        <td className="p-4 text-gray-500">{badge.originalDate}</td>
                                        <td className="p-4 font-mono text-gray-600">{badge.matricula}</td>
                                        <td className="p-4 font-medium">
                                            {badge.name}
                                            <div className="text-xs text-gray-400">{badge.department}</div>
                                        </td>
                                        <td className="p-4">
                                            {isSuperAdmin ? (
                                                <select
                                                    value={badge.status}
                                                    onChange={(e) => handleStatusChange(badge.id, e.target.value)}
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold border bg-transparent cursor-pointer ${getStatusColor(badge.status)}`}
                                                >
                                                    {uniqueStatuses.filter(s => s !== 'Todos').map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(badge.status)}`}>{badge.status}</span>
                                            )}
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleDelete(badge.id)} className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BadgeManagementModule;
