
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, limit, writeBatch, getDoc, arrayUnion } from 'firebase/firestore';
import { Search, Check, Loader2, Calendar, FileText, Trash2, X } from 'lucide-react';
import { useAuth } from './AuthContext';

interface ProductRequest {
    ean: string;
    description: string;
    internalCode?: string;
    companyName?: string;
    userName?: string;
    lastRequestedAt: any; // Timestamp
    status: 'pending' | 'resolved';
    requesters?: {
        companyId: string;
        companyName: string;
        userName: string;
        requestedAt: any;
    }[];
    type?: 'images' | 'laminas';
}

const RequestsModule = () => {
    const { userData } = useAuth();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [checkingAll, setCheckingAll] = useState(false);
    const [selectedEans, setSelectedEans] = useState<string[]>([]);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);
    const [activeType, setActiveType] = useState<'images' | 'laminas'>('images');

    useEffect(() => {
        if (userData?.role === 'admin' || userData?.role === 'super_admin') {
            fetchRequests();
        }
    }, [userData, activeType]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            let q;
            if (activeType === 'laminas') {
                q = query(
                    collection(db, 'product_requests'),
                    where('status', '==', 'pending'),
                    where('type', '==', 'laminas'),
                    limit(300)
                );
            } else {
                // For 'images', we also include legacy requests where type is missing
                q = query(
                    collection(db, 'product_requests'),
                    where('status', '==', 'pending'),
                    limit(300)
                );
            }

            const snapshot = await getDocs(q);
            let fetchedRequests = snapshot.docs.map(doc => doc.data() as ProductRequest);

            // Additional client-side filter for 'images' tab to exclude 'laminas'
            if (activeType === 'images') {
                fetchedRequests = fetchedRequests.filter(r => !r.type || r.type === 'images');
            }

            // Client-side sort: newest first
            fetchedRequests.sort((a, b) => {
                const dateA = a.lastRequestedAt?.seconds || 0;
                const dateB = b.lastRequestedAt?.seconds || 0;
                return dateB - dateA;
            });

            setRequests(fetchedRequests);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const checkImageExists = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            // Timeout to avoid hanging
            setTimeout(() => resolve(false), 3000);
        });
    };

    const handleResolveFound = async () => {
        if (checkingAll) return;
        setCheckingAll(true);
        try {
            const updates: string[] = [];
            // Check only first 20 to be fast or all if list is small
            const listToCheck = requests.slice(0, 50);

            await Promise.all(listToCheck.map(async (req) => {
                const isLaminas = req.type === 'laminas';
                const primaryUrl = isLaminas
                    ? `https://imagens.canvazap.com.br/laminas/${req.ean}.jpg`
                    : `https://imagens.canvazap.com.br/codbarras/${req.ean}.png`;

                if (await checkImageExists(primaryUrl)) {
                    updates.push(req.ean);
                }
            }));

            if (updates.length > 0) {
                const batch = writeBatch(db);
                updates.forEach(ean => {
                    const req = requests.find(r => r.ean === ean);
                    batch.update(doc(db, 'product_requests', ean), {
                        status: 'resolved',
                        resolvedAt: new Date(),
                        resolvedBy: userData?.uid,
                        autoResolved: true
                    });
                    if (req) {
                        const isLaminas = req.type === 'laminas';
                        batch.set(doc(db, 'products', ean), {
                            ean: ean,
                            name: req.description,
                            internalCode: req.internalCode || '',
                            imageUrl: isLaminas
                                ? `https://imagens.canvazap.com.br/laminas/${ean}.jpg`
                                : `https://imagens.canvazap.com.br/codbarras/${ean}.png`,
                            updatedAt: new Date(),
                            hasImage: true
                        }, { merge: true });
                    }
                });
                await batch.commit();
                alert(`${updates.length} itens encontrados e resolvidos automaticamente!`);
                fetchRequests();
            } else {
                alert("Nenhum item com imagem disponível no momento.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setCheckingAll(false);
        }
    };

    const handleManualResolve = async (ean: string) => {
        const req = requests.find(r => r.ean === ean);
        if (!req) return;

        if (!confirm(`Resolver "${req.description}"?`)) return;

        try {
            await updateDoc(doc(db, 'product_requests', ean), {
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedBy: userData?.uid
            });

            const isLaminas = req.type === 'laminas';
            await setDoc(doc(db, 'products', ean), {
                ean: ean,
                name: req.description,
                internalCode: req.internalCode || '',
                imageUrl: isLaminas
                    ? `https://imagens.canvazap.com.br/laminas/${ean}.jpg`
                    : `https://imagens.canvazap.com.br/codbarras/${ean}.png`,
                updatedAt: new Date(),
                hasImage: true
            }, { merge: true });

            setRequests(prev => prev.filter(r => r.ean !== ean));
        } catch (error) {
            console.error(error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedEans.length === 0) return;
        if (!confirm(`APAGAR ${selectedEans.length} solicitações?`)) return;

        setIsProcessingBulk(true);
        try {
            const batch = writeBatch(db);
            selectedEans.forEach(ean => {
                batch.delete(doc(db, 'product_requests', ean));
            });
            await batch.commit();
            setRequests(prev => prev.filter(r => !selectedEans.includes(r.ean)));
            setSelectedEans([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessingBulk(false);
        }
    };

    const handleBulkResolve = async () => {
        if (selectedEans.length === 0) return;
        if (!confirm(`Resolver ${selectedEans.length} solicitações?`)) return;

        setIsProcessingBulk(true);
        try {
            const batch = writeBatch(db);
            selectedEans.forEach(ean => {
                const req = requests.find(r => r.ean === ean);
                if (req) {
                    batch.update(doc(db, 'product_requests', ean), {
                        status: 'resolved',
                        resolvedAt: new Date(),
                        resolvedBy: userData?.uid
                    });
                    const isLaminas = req.type === 'laminas';
                    batch.set(doc(db, 'products', ean), {
                        ean: ean,
                        name: req.description,
                        internalCode: req.internalCode || '',
                        imageUrl: isLaminas
                            ? `https://imagens.canvazap.com.br/laminas/${ean}.jpg`
                            : `https://imagens.canvazap.com.br/codbarras/${ean}.png`,
                        updatedAt: new Date(),
                        hasImage: true
                    }, { merge: true });
                }
            });
            await batch.commit();
            setRequests(prev => prev.filter(r => !selectedEans.includes(r.ean)));
            setSelectedEans([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessingBulk(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedEans.length === filteredRequests.length) {
            setSelectedEans([]);
        } else {
            setSelectedEans(filteredRequests.map(r => r.ean));
        }
    };

    const toggleSelect = (ean: string) => {
        setSelectedEans(prev =>
            prev.includes(ean) ? prev.filter(e => e !== ean) : [...prev, ean]
        );
    };

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return <div className="p-8 text-center">Acesso restrito.</div>;
    }

    const filteredRequests = requests.filter(r => {
        const matchesType = activeType === 'laminas' ? r.type === 'laminas' : (!r.type || r.type === 'images');
        const matchesSearch = r.ean.includes(searchTerm) ||
            r.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
    });

    return (
        <div className="fade-in">
            <h1 className="title" style={{ marginBottom: '1.5rem' }}>
                {activeType === 'images' ? 'Solicitações de Imagens' : 'Solicitações de Lâminas'}
            </h1>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', width: 'fit-content' }}>
                <button
                    onClick={() => setActiveType('images')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        color: activeType === 'images' ? 'var(--primary-color)' : 'var(--text-muted)',
                        borderBottom: activeType === 'images' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Imagens
                </button>
                <button
                    onClick={() => setActiveType('laminas')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        color: activeType === 'laminas' ? 'var(--primary-color)' : 'var(--text-muted)',
                        borderBottom: activeType === 'laminas' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Lâminas
                </button>
            </div>

            <p className="subtitle" style={{ marginBottom: '2rem' }}>
                {activeType === 'images'
                    ? 'Gerencie itens que aguardam cadastro de imagem (Encartes/Flyers).'
                    : 'Gerencie solicitações de criação de lâminas individuais (Catálogo).'}
            </p>

            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: '2.5rem' }}
                            placeholder="Buscar EAN ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className="btn-secondary"
                            onClick={handleResolveFound}
                            disabled={loading || checkingAll || requests.length === 0}
                            style={{ borderColor: '#22c55e', color: '#16a34a', background: '#f0fdf4' }}
                        >
                            {checkingAll ? <Loader2 className="loading-spinner" /> : <><Check size={18} /> Limpar Existentes</>}
                        </button>
                        <button className="btn btn-primary" onClick={fetchRequests} disabled={loading || checkingAll}>
                            {loading ? <Loader2 className="loading-spinner" /> : 'Atualizar Lista'}
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', width: '45px' }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredRequests.length > 0 && selectedEans.length === filteredRequests.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EAN</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DESCRIÇÃO</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SOLICITANTE</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PREVIEW</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map(req => (
                                <tr key={req.ean} style={{ borderBottom: '1px solid var(--border-color)', background: selectedEans.includes(req.ean) ? '#f0f7ff' : 'transparent' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedEans.includes(req.ean)}
                                            onChange={() => toggleSelect(req.ean)}
                                        />
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600 }}>{req.ean}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 500 }}>{req.description}</div>
                                        {req.internalCode && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód: {req.internalCode}</div>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{req.companyName || 'Empresa'}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{req.userName || 'Usuário'}</div>
                                        {req.requesters && req.requesters.length > 1 && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 600, marginTop: '2px' }}>
                                                + {req.requesters.length - 1} outros pediram
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {req.lastRequestedAt?.toDate().toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ width: '42px', height: '42px', margin: '0 auto', background: '#f8fafc', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                                            <img
                                                src={req.type === 'laminas'
                                                    ? `https://imagens.canvazap.com.br/laminas/${req.ean}.jpg`
                                                    : `https://imagens.canvazap.com.br/codbarras/${req.ean}.png`}
                                                alt="Check"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (!target.src.includes('cdn-cosmos.bluesoft.com.br')) {
                                                        target.src = `https://cdn-cosmos.bluesoft.com.br/products/${req.ean}`;
                                                    } else {
                                                        target.style.display = 'none';
                                                        target.parentElement!.innerHTML = '<span style="font-size: 0.6rem; color: #94a3b8">404</span>';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleManualResolve(req.ean)}>
                                            <Check size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedEans.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--primary-color)', color: 'white', padding: '0.75rem 1.5rem',
                    borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '1rem',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 1000
                }}>
                    <span style={{ fontWeight: 600 }}>{selectedEans.length} selecionados</span>
                    <button onClick={handleBulkResolve} disabled={isProcessingBulk} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Resolver</button>
                    <button onClick={handleBulkDelete} disabled={isProcessingBulk} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Apagar</button>
                    <button onClick={() => setSelectedEans([])} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
                </div>
            )}
        </div>
    );
};

export default RequestsModule;
