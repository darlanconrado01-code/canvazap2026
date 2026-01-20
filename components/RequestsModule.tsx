
import React, { useState, useEffect } from 'react';
import { db, storage } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Image as ImageIcon, Upload, Check, Loader2, AlertCircle, Calendar, FileText } from 'lucide-react';
import { useAuth } from './AuthContext';

interface ProductRequest {
    ean: string;
    description: string;
    internalCode?: string;
    companyName?: string;
    userName?: string;
    lastRequestedBy: string;
    lastRequestedAt: any; // Timestamp
    status: 'pending' | 'resolved';
}

const RequestsModule = () => {
    const { userData } = useAuth();
    const [requests, setRequests] = useState<ProductRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [checkingAll, setCheckingAll] = useState(false);

    useEffect(() => {
        // Simple protection: only admins can see this
        // In a real app, you'd check a specific claim or UID for "Super Admin"
        if (userData?.role === 'admin') {
            fetchRequests();
        }
    }, [userData]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // Get pending requests
            // We can order by date desc to see newest first
            const q = query(
                collection(db, 'product_requests'),
                where('status', '==', 'pending'),
                // orderBy('lastRequestedAt', 'desc'), // Removed to avoid index requirement
                limit(100)
            );

            const snapshot = await getDocs(q);
            const fetchedRequests = snapshot.docs.map(doc => doc.data() as ProductRequest);

            // Client-side sort
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
        });
    };

    const handleResolveAll = async () => {
        if (checkingAll) return;
        if (!confirm("O sistema verificará a disponibilidade de imagem para todos os itens da lista atual. Isso pode levar alguns segundos. Continuar?")) return;

        setCheckingAll(true);
        try {
            const updates: ProductRequest[] = [];

            // Parallel checks
            await Promise.all(requests.map(async (req) => {
                const primaryUrl = `https://imagens.canvazap.com.br/codbarras/${req.ean}.png`;
                const secondaryUrl = `https://cdn-cosmos.bluesoft.com.br/products/${req.ean}`;

                // Check primary then secondary
                if (await checkImageExists(primaryUrl)) {
                    updates.push(req);
                } else if (await checkImageExists(secondaryUrl)) {
                    updates.push(req);
                }
            }));

            if (updates.length > 0) {
                const batch = writeBatch(db);
                updates.forEach(req => {
                    // 1. Resolve Request
                    const reqRef = doc(db, 'product_requests', req.ean);
                    batch.update(reqRef, {
                        status: 'resolved',
                        resolvedAt: new Date(),
                        resolvedBy: userData?.uid,
                        autoResolved: true
                    });

                    // 2. Ensure Product Exists (Officializing)
                    const prodRef = doc(db, 'products', req.ean);
                    // We save the standard URL to leverage the fallback logic
                    batch.set(prodRef, {
                        ean: req.ean,
                        name: req.description,
                        imageUrl: `https://imagens.canvazap.com.br/codbarras/${req.ean}.png`,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true });
                });

                await batch.commit();
                alert(`${updates.length} itens foram identificados e resolvidos automaticamente!`);
                fetchRequests(); // Refresh
            } else {
                alert("Nenhuma imagem encontrada para os itens listados.");
            }

        } catch (error) {
            console.error(error);
            alert("Erro ao processar verificação em massa.");
        } finally {
            setCheckingAll(false);
        }
    };

    const handleManualResolve = async (ean: string) => {
        if (!confirm("Confirmar que a imagem está disponível e remover da lista?")) return;
        await updateDoc(doc(db, 'product_requests', ean), {
            status: 'resolved',
            resolvedAt: new Date(),
            resolvedBy: userData?.uid
        });

        // Also ensure it is created as a product if not exists, so it appears in everyone's list?
        // Actually, ImageBankModule already handles it if the image exists at the URL.
        // But creating the product doc ensures name consistency.
        // Let's rely on the requested description.
        const req = requests.find(r => r.ean === ean);
        if (req) {
            await setDoc(doc(db, 'products', ean), {
                ean: ean,
                name: req.description,
                imageUrl: `https://imagens.canvazap.com.br/codbarras/${ean}.png`,
                createdAt: new Date(),
                updatedAt: new Date()
            }, { merge: true });
        }

        setRequests(prev => prev.filter(r => r.ean !== ean));
    };

    if (userData?.role !== 'admin') {
        return <div className="p-8 text-center">Acesso restrito a administradores.</div>;
    }

    const filteredRequests = requests.filter(r =>
        r.ean.includes(searchTerm) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            <h1 className="title" style={{ marginBottom: '1.5rem' }}>Solicitações de Imagens</h1>
            <p className="subtitle" style={{ marginBottom: '2rem' }}>
                Gerencie itens importados que aguardam cadastro oficial de imagem no servidor externo.
            </p>

            <div className="glass-card">
                {/* Toolbar */}
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
                            onClick={handleResolveAll}
                            disabled={loading || checkingAll || requests.length === 0}
                            style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                        >
                            {checkingAll ? <Loader2 className="loading-spinner" /> : 'Verificar & Resolver Todos'}
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
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ITEM SOLICITADO</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SOLICITANTE</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>IMAGEM EXTERNA</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map(req => (
                                <tr key={req.ean} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{req.description}</div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '4px' }}>
                                            <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                                                EAN: {req.ean}
                                            </div>
                                            {req.internalCode && (
                                                <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning-color)' }}></div>
                                                    Cód: {req.internalCode}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{req.companyName || 'Empresa desconhecida'}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {req.userName || 'Usuário desconhecido'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={12} />
                                            {req.lastRequestedAt?.toDate().toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {/* Preview External Image Check */}
                                        <div style={{ width: '48px', height: '48px', margin: '0 auto', background: '#f8fafc', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                                            <img
                                                src={`https://imagens.canvazap.com.br/codbarras/${req.ean}.png`}
                                                alt="Check"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (!target.src.includes('cdn-cosmos.bluesoft.com.br')) {
                                                        target.src = `https://cdn-cosmos.bluesoft.com.br/products/${req.ean}`;
                                                    } else {
                                                        target.style.display = 'none';
                                                        target.parentElement!.innerHTML = '<span style="font-size: 0.7rem; color: #94a3b8">404</span>';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                            onClick={() => handleManualResolve(req.ean)}
                                            title="Confirmar que a imagem existe e arquivar solicitação"
                                        >
                                            <Check size={16} />
                                            Resolvido
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredRequests.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <Check size={48} style={{ opacity: 0.2 }} />
                                            <span>Nenhuma solicitação pendente!</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RequestsModule;
