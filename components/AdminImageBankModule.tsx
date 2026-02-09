
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, writeBatch, limit, deleteDoc, orderBy, getDoc } from 'firebase/firestore';
import { Search, Plus, Image as ImageIcon, Trash2, Edit, AlertCircle, Check, Filter, ChevronRight, ChevronLeft, Building2, Globe, Loader2 } from 'lucide-react';

interface Product {
    ean: string;
    name: string;
    imageUrl: string;
    hasImage?: boolean;
    updatedAt?: Date;
}

interface Mapping {
    id: string;
    companyId: string;
    ean: string;
    internalCode: string;
    description: string;
    companyName?: string;
    type?: 'mapping' | 'global';
    hasImage?: boolean;
}

const AdminImageBankModule = () => {
    const { userData } = useAuth();
    const [viewMode, setViewMode] = useState<'global' | 'company'>('global');
    const [products, setProducts] = useState<Product[]>([]);
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [imgFilter, setImgFilter] = useState<'all' | 'with' | 'without'>('all');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        if (userData?.isSystemAdmin) {
            fetchInitialData();
        }
    }, [userData]);

    useEffect(() => {
        setCurrentPage(1);
        if (viewMode === 'global') {
            fetchGlobalProducts();
        } else if (selectedCompanyId) {
            fetchCompanyMappings();
        }
    }, [viewMode, selectedCompanyId, searchTerm, imgFilter]);

    const fetchInitialData = async () => {
        try {
            const snap = await getDocs(collection(db, 'companies'));
            setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching companies:", error);
        }
    };

    const fetchGlobalProducts = async () => {
        setLoading(true);
        try {
            const productsRef = collection(db, 'products');
            let productList: Product[] = [];

            if (searchTerm) {
                const term = searchTerm.trim();
                const isEan = /^\d+$/.test(term);

                if (isEan) {
                    const qEan = query(productsRef, where('ean', '==', term));
                    const snapEan = await getDocs(qEan);
                    productList = snapEan.docs.map(d => ({ ean: d.id, ...d.data() } as Product));

                    if (productList.length === 0 && term.length >= 3) {
                        const qEanPre = query(productsRef, where('ean', '>=', term), where('ean', '<=', term + '\uf8ff'), limit(100));
                        const snapEanPre = await getDocs(qEanPre);
                        productList = snapEanPre.docs.map(d => ({ ean: d.id, ...d.data() } as Product));
                    }
                } else {
                    // Try prefix search with original and capitalized
                    const q1 = query(productsRef, where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(100));
                    const snap1 = await getDocs(q1);
                    productList = snap1.docs.map(d => ({ ean: d.id, ...d.data() } as Product));

                    if (productList.length < 20) {
                        const capitalized = term.charAt(0).toUpperCase() + term.slice(1);
                        if (capitalized !== term) {
                            const q2 = query(productsRef, where('name', '>=', capitalized), where('name', '<=', capitalized + '\uf8ff'), limit(100));
                            const snap2 = await getDocs(q2);
                            const res2 = snap2.docs.map(d => ({ ean: d.id, ...d.data() } as Product));
                            const existingEans = new Set(productList.map(p => p.ean));
                            res2.forEach(p => { if (!existingEans.has(p.ean)) productList.push(p); });
                        }
                    }
                }
            } else {
                let constraints: any[] = [orderBy('name')];
                if (imgFilter === 'with') constraints.push(where('hasImage', '==', true));
                if (imgFilter === 'without') constraints.push(where('hasImage', '==', false));
                let q = query(productsRef, ...constraints, limit(200));
                const snap = await getDocs(q);
                productList = snap.docs.map(d => ({ ean: d.id, ...d.data() } as Product));
            }

            setProducts(productList);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyMappings = async () => {
        if (!selectedCompanyId) return;
        setLoading(true);
        try {
            const mappingsRef = collection(db, 'product_mappings');
            let mappingList: any[] = [];

            // 1. Fetch Mappings (always filter by company)
            const mappingQ = query(mappingsRef, where('companyId', '==', selectedCompanyId));
            const snap = await getDocs(mappingQ);
            let rawMappings = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'mapping' } as any as Mapping));

            // Client side filter for mappings (since we fetch all for one company)
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                rawMappings = rawMappings.filter(m =>
                    m.ean.includes(term) ||
                    m.description.toLowerCase().includes(term) ||
                    m.internalCode.toLowerCase().includes(term)
                );
            }

            // 2. If searching, ALSO fetch Global results to show what's discoverable
            if (searchTerm && searchTerm.length >= 3) {
                const term = searchTerm.trim();
                const productsRef = collection(db, 'products');
                let globalResults: Product[] = [];

                if (/^\d+$/.test(term)) {
                    const qEan = query(productsRef, where('ean', '==', term), limit(20));
                    const snapEan = await getDocs(qEan);
                    globalResults = snapEan.docs.map(d => ({ ean: d.id, ...d.data() } as Product));
                } else {
                    const qName = query(productsRef, where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(20));
                    const snapName = await getDocs(qName);
                    globalResults = snapName.docs.map(d => ({ ean: d.id, ...d.data() } as Product));

                    if (globalResults.length < 5) {
                        const capitalized = term.charAt(0).toUpperCase() + term.slice(1);
                        const q2 = query(productsRef, where('name', '>=', capitalized), where('name', '<=', capitalized + '\uf8ff'), limit(20));
                        const snap2 = await getDocs(q2);
                        const res2 = snap2.docs.map(d => ({ ean: d.id, ...d.data() } as Product));
                        const existingEans = new Set(globalResults.map(p => p.ean));
                        res2.forEach(p => { if (!existingEans.has(p.ean)) globalResults.push(p); });
                    }
                }

                // Filter out global products that are already in rawMappings
                const mappedEans = new Set(rawMappings.map(m => m.ean));
                const unmappedGlobals = globalResults
                    .filter(p => !mappedEans.has(p.ean))
                    .map(p => ({
                        id: `global-${p.ean}`,
                        ean: p.ean,
                        description: p.name,
                        internalCode: '-',
                        companyId: '',
                        type: 'global',
                        hasImage: p.hasImage
                    }));

                mappingList = [...rawMappings, ...unmappedGlobals];
            } else {
                mappingList = rawMappings;
            }

            // Fetch image status for mappings if needed (batching)
            const eansToFetch = mappingList.filter(m => m.type === 'mapping').map(m => m.ean);
            const imageStatus: Record<string, boolean> = {};

            for (let i = 0; i < eansToFetch.length; i += 30) {
                const chunk = eansToFetch.slice(i, i + 30);
                if (chunk.length > 0) {
                    const qP = query(collection(db, 'products'), where('ean', 'in', chunk));
                    const snapP = await getDocs(qP);
                    snapP.forEach(doc => { imageStatus[doc.id] = doc.data().hasImage === true; });
                }
            }

            mappingList = mappingList.map(m => ({
                ...m,
                hasImage: m.type === 'global' ? m.hasImage : (imageStatus[m.ean] || false)
            }));

            if (imgFilter !== 'all') {
                mappingList = mappingList.filter(m => m.hasImage === (imgFilter === 'with'));
            }

            setMappings(mappingList);
        } catch (error) {
            console.error("Error fetching mappings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Tem certeza que deseja excluir ${selectedItems.length} itens?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedItems.forEach(id => {
                if (viewMode === 'global') {
                    batch.delete(doc(db, 'products', id));
                } else {
                    batch.delete(doc(db, 'product_mappings', id));
                }
            });
            await batch.commit();
            setSelectedItems([]);
            if (viewMode === 'global') fetchGlobalProducts();
            else fetchCompanyMappings();
        } catch (error) {
            console.error("Error bulk deleting:", error);
            alert("Erro ao excluir itens.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelectAll = () => {
        if (selectedItems.length === paginatedItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(paginatedItems.map(item => viewMode === 'global' ? (item as Product).ean : (item as Mapping).id));
        }
    };

    const handleToggleSelect = (id: string) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(i => i !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const items = viewMode === 'global' ? products : mappings;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="title">Gerenciador de Banco de Imagens</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className={`btn ${viewMode === 'global' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('global')}
                    >
                        <Globe size={18} /> Banco Global
                    </button>
                    <button
                        className={`btn ${viewMode === 'company' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('company')}
                    >
                        <Building2 size={18} /> Por Empresa
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: '2.5rem' }}
                            placeholder="Buscar por EAN, Nome ou Descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            className={`btn ${imgFilter === 'all' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: imgFilter === 'all' ? 'var(--primary-color)' : 'transparent', color: imgFilter === 'all' ? 'white' : 'var(--text-secondary)', border: 'none' }}
                            onClick={() => setImgFilter('all')}
                        >
                            Todos
                        </button>
                        <button
                            className={`btn ${imgFilter === 'with' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: imgFilter === 'with' ? 'var(--primary-color)' : 'transparent', color: imgFilter === 'with' ? 'white' : 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setImgFilter('with')}
                        >
                            <Check size={14} /> Com Imagem
                        </button>
                        <button
                            className={`btn ${imgFilter === 'without' ? 'btn-primary' : ''}`}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: imgFilter === 'without' ? 'var(--primary-color)' : 'transparent', color: imgFilter === 'without' ? 'white' : 'var(--text-secondary)', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setImgFilter('without')}
                        >
                            <AlertCircle size={14} /> Sem Imagem
                        </button>
                    </div>

                    {viewMode === 'company' && (
                        <select
                            className="form-input"
                            style={{ width: '250px' }}
                            value={selectedCompanyId}
                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                        >
                            <option value="">Selecionar Empresa...</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                    {selectedItems.length > 0 && (
                        <button className="btn btn-danger" onClick={handleBulkDelete} style={{ background: '#ef4444', color: 'white' }}>
                            <Trash2 size={18} /> Excluir ({selectedItems.length})
                        </button>
                    )}
                </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <Loader2 className="loading-spinner" size={40} />
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', width: '40px' }}>
                                    <input type="checkbox" checked={selectedItems.length > 0 && selectedItems.length === paginatedItems.length} onChange={handleToggleSelectAll} />
                                </th>
                                <th style={{ padding: '1rem', textAlign: 'center', width: '80px' }}>Imagem</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>{viewMode === 'global' ? 'Nome do Produto' : 'Descrição Empresa'}</th>
                                <th style={{ padding: '1rem', textAlign: 'left' }}>EAN</th>
                                {viewMode === 'company' && <th style={{ padding: '1rem', textAlign: 'left' }}>Cód. Interno</th>}
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.map((item) => {
                                const id = viewMode === 'global' ? (item as Product).ean : (item as Mapping).id;
                                const ean = (item as any).ean;
                                const name = viewMode === 'global' ? (item as Product).name : (item as Mapping).description;
                                const imageUrl = (item as any).imageUrl || `https://imagens.canvazap.com.br/codbarras/${ean}.png`;

                                return (
                                    <tr key={id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <input type="checkbox" checked={selectedItems.includes(id)} onChange={() => handleToggleSelect(id)} />
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ width: '48px', height: '48px', margin: '0 auto', background: '#f8fafc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #eee' }}>
                                                <img
                                                    src={imageUrl}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        if (!target.src.includes('cdn-cosmos.bluesoft.com.br')) {
                                                            target.src = `https://cdn-cosmos.bluesoft.com.br/products/${ean}`;
                                                        } else {
                                                            target.style.display = 'none';
                                                            target.parentElement!.innerHTML = '<div style="color: #cbd5e1"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontWeight: 600 }}>{name || 'Sem nome'}</div>
                                                {(item as any).type === 'global' && (
                                                    <span style={{ fontSize: '0.65rem', background: 'var(--primary-color)', color: 'white', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>Global</span>
                                                )}
                                            </div>
                                            {viewMode === 'company' && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                    {(item as any).type === 'global' ? 'Não vinculado a esta empresa' : `EAN Original: ${ean}`}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>{ean}</td>
                                        {viewMode === 'company' && (
                                            <td style={{ padding: '0.75rem' }}>
                                                {(item as any).type === 'mapping' ? (
                                                    <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                                                        {(item as Mapping).internalCode}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                                                )}
                                            </td>
                                        )}
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button className="btn-icon" title="Editar"><Edit size={16} /></button>
                                                <button className="btn-icon" style={{ color: '#ef4444' }} title="Excluir" onClick={() => {
                                                    setSelectedItems([id]);
                                                    handleBulkDelete();
                                                }}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedItems.length === 0 && (
                                <tr>
                                    <td colSpan={viewMode === 'global' ? 5 : 6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {viewMode === 'company' && !selectedCompanyId ? 'Selecione uma empresa para listar os produtos' : 'Nenhum produto encontrado.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, items.length)} de {items.length}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn-secondary"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                            >
                                <ChevronLeft size={16} /> Anterior
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', fontWeight: 600 }}>
                                {currentPage} / {totalPages}
                            </div>
                            <button
                                className="btn-secondary"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                            >
                                Próxima <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminImageBankModule;

