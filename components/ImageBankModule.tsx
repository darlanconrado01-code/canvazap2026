
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db, storage } from '../services/firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, writeBatch, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Plus, Image as ImageIcon, Upload, Save, Loader2, Barcode, Trash2, Edit, AlertTriangle, Check } from 'lucide-react';

interface Product {
    ean: string;
    name: string;
    imageUrl: string;
    internalCode?: string; // Merged from mapping
}

const ImageBankModule = () => {
    const { userData } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk Import State
    const [bulkText, setBulkText] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Add Modal State (Keep for manual single add)
    const [showModal, setShowModal] = useState(false);
    // ... (keep modal existing state logic if needed, or simplify)

    // Bulk Actions State
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // We'll keep the modal state for "New Product" briefly, but focus on the new layout
    const [newEan, setNewEan] = useState('');
    const [newName, setNewName] = useState('');
    const [newImage, setNewImage] = useState<File | null>(null);
    const [newInternalCode, setNewInternalCode] = useState(''); // Kept for modal
    const [uploading, setUploading] = useState(false);
    const [addError, setAddError] = useState(''); // Kept for modal

    useEffect(() => {
        if (userData?.companyId) {
            fetchProducts();
        }
    }, [userData, userData?.companyId]); // Re-fetch if company context changes

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // 1. Fetch My Company Mappings (The "My List" source of truth)
            const myMappingsMap: Record<string, any> = {};
            const myMappedProducts: Product[] = [];

            if (userData?.companyId) {
                const mappingQ = query(collection(db, 'product_mappings'), where('companyId', '==', userData.companyId));
                const mappingSnapshot = await getDocs(mappingQ);

                mappingSnapshot.forEach(doc => {
                    const data = doc.data();
                    myMappingsMap[data.ean] = { internalCode: data.internalCode, description: data.description };

                    // Creates a "Stub" product from the mapping alone
                    myMappedProducts.push({
                        ean: data.ean,
                        name: data.description || '', // Use mapped description if available
                        imageUrl: `https://imagens.canvazap.com.br/codbarras/${data.ean}.png`,
                        internalCode: data.internalCode
                    });
                });
            }

            // 2. Fetch Global Products (To get official names if needed)
            let q = query(collection(db, 'products'), limit(50));
            if (searchTerm && /^\d+$/.test(searchTerm)) {
                q = query(collection(db, 'products'), where('ean', '==', searchTerm));
            }

            const productSnapshot = await getDocs(q);
            const globalProducts = productSnapshot.docs.map(doc => doc.data() as Product);

            // 3. Merge logic: Union of (Mapped Items) and (Fetched Global Items)
            const combinedMap: Record<string, Product> = {};

            // A. Add Global Products first
            globalProducts.forEach(p => {
                const mapping = myMappingsMap[p.ean];
                combinedMap[p.ean] = {
                    ...p,
                    internalCode: mapping?.internalCode || '',
                    // Prefer user Description over Global Name if they defined one in mapping
                    name: mapping?.description || p.name
                };
            });

            // B. Add/Overlay Mapped Products
            myMappedProducts.forEach(mp => {
                if (combinedMap[mp.ean]) {
                    // Update the global one with local mapping details
                    combinedMap[mp.ean].internalCode = mp.internalCode;
                    if (mp.name) combinedMap[mp.ean].name = mp.name;
                } else {
                    // Not found in global fetch -> Add the stub
                    combinedMap[mp.ean] = mp;
                }
            });

            setProducts(Object.values(combinedMap));
        } catch (error) {
            console.error("Error fetching image bank:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        setAddError('');

        try {
            // 1. Check if EAN exists (to avoid duplicates description)
            const eanRef = doc(db, 'products', newEan);

            let imageUrl = '';
            // If manual add, we might want to allow custom image OR use standard
            // For now, let's stick to the previous logic of uploading if provided
            // OR if strictly following the new rule, we could force the standard URL.
            // But if user uploads, let's respect it for now or just save the URL.

            if (newImage) {
                const storageRef = ref(storage, `products/${newEan}/${newImage.name}`);
                await uploadBytes(storageRef, newImage);
                imageUrl = await getDownloadURL(storageRef);
            } else {
                // Fallback to standard if no image provided?
                // or error as before. Let's keep existing logic to not break manual flow.
                imageUrl = `https://imagens.canvazap.com.br/codbarras/${newEan}.png`;
            }

            // 2. Save Product
            const productData = {
                ean: newEan,
                name: newName,
                imageUrl: imageUrl,
                createdAt: new Date()
            };
            await setDoc(eanRef, productData, { merge: true });

            // 3. Save Mapping (if internal code provided)
            if (newInternalCode && userData?.companyId) {
                await saveMapping(newEan, newInternalCode, newName);
            }

            setShowModal(false);
            setNewEan('');
            setNewName('');
            setNewImage(null);
            setNewInternalCode('');
            fetchProducts();

        } catch (error: any) {
            console.error(error);
            setAddError(error.message || "Erro ao salvar produto.");
        } finally {
            setUploading(false);
        }
    };

    const saveMapping = async (ean: string, code: string, description: string) => {
        const mappingId = `${userData!.companyId}_${ean}`;
        await setDoc(doc(db, 'product_mappings', mappingId), {
            companyId: userData!.companyId,
            ean: ean,
            internalCode: code,
            description: description
        });
    };

    const handleBulkImport = async () => {
        if (!bulkText.trim() || !userData?.companyId) return;
        setBulkLoading(true);
        setBulkMessage(null);

        try {
            const lines = bulkText.split('\n');
            const validLines = lines.filter(l => l.trim().length > 0);

            let successCount = 0;
            let alreadyExistsCount = 0;
            const CHUNK_SIZE = 50; // Smaller chunks for HTTP checks

            const checkImageExists = (url: string): Promise<boolean> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    const timeout = setTimeout(() => { img.src = ''; resolve(false); }, 3000);
                    img.onload = () => { clearTimeout(timeout); resolve(true); };
                    img.onerror = () => { clearTimeout(timeout); resolve(false); };
                    img.src = url;
                });
            };

            for (let i = 0; i < validLines.length; i += CHUNK_SIZE) {
                const chunk = validLines.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                let opsInBatch = 0;

                // 1. Identify EANs in this chunk
                const itemsToProcess = chunk.map(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 2) return null;

                    let eanIndex = -1;
                    if (/^\d{7,14}$/.test(parts[parts.length - 1])) eanIndex = parts.length - 1;
                    else if (/^\d{7,14}$/.test(parts[1])) eanIndex = 1;
                    else eanIndex = parts.findIndex(p => /^\d{8,14}$/.test(p));

                    if (eanIndex === -1) return null;

                    const ean = parts[eanIndex];
                    const internalCode = parts[0];
                    const descriptionParts = parts.filter((_, idx) => idx !== 0 && idx !== eanIndex);
                    const description = descriptionParts.join(' ');

                    return { ean, internalCode, description };
                }).filter(item => item !== null) as { ean: string, internalCode: string, description: string }[];

                if (itemsToProcess.length === 0) continue;

                // 2. Fetch existing products for these EANs to check 'hasImage' flag
                const eans = itemsToProcess.map(it => it.ean);
                // Firestore 'in' limit is now 30, so let's use smaller sub-chunks if needed or just process
                const productsMap: Record<string, any> = {};

                // For simplicity and speed in this context, we take chunks of 30
                for (let j = 0; j < eans.length; j += 30) {
                    const subEans = eans.slice(j, j + 30);
                    const qProducts = query(collection(db, 'products'), where('ean', 'in', subEans));
                    const snapProducts = await getDocs(qProducts);
                    snapProducts.forEach(doc => {
                        productsMap[doc.data().ean] = doc.data();
                    });
                }

                // 3. Process items
                await Promise.all(itemsToProcess.map(async (item) => {
                    const existingProduct = productsMap[item.ean];
                    let hasImage = existingProduct?.hasImage === true;

                    // If not flagged but product exists, or doesn't exist, check the server
                    if (!hasImage && item.ean.length > 5 && !item.ean.includes('/')) {
                        const standardUrl = `https://imagens.canvazap.com.br/codbarras/${item.ean}.png`;
                        hasImage = await checkImageExists(standardUrl);
                    }

                    // A. Update Mapping (Always)
                    const mappingId = `${userData.companyId}_${item.ean}`;
                    batch.set(doc(db, 'product_mappings', mappingId), {
                        companyId: userData.companyId,
                        ean: item.ean,
                        internalCode: item.internalCode,
                        description: item.description,
                        updatedAt: new Date()
                    }, { merge: true });
                    opsInBatch++;

                    // B. Handle Product Document
                    if (hasImage) {
                        // Mark as having image in products collection
                        batch.set(doc(db, 'products', item.ean), {
                            ean: item.ean,
                            name: item.description,
                            imageUrl: `https://imagens.canvazap.com.br/codbarras/${item.ean}.png`,
                            hasImage: true,
                            updatedAt: new Date()
                        }, { merge: true });
                        opsInBatch++;

                        // If it was pending, we could resolve it, but here it's easier to just skip the request
                        alreadyExistsCount++;
                    } else {
                        // Create/Update Product Request
                        const currentMembership = userData.memberships?.find(m => m.companyId === userData.companyId);
                        const companyName = currentMembership?.companyName || 'Empresa Indefinida';
                        const userName = userData.displayName || userData.email || 'Usuário';

                        batch.set(doc(db, 'product_requests', item.ean), {
                            ean: item.ean,
                            description: item.description,
                            internalCode: item.internalCode,
                            companyName: companyName,
                            userName: userName,
                            lastRequestedBy: userData.companyId,
                            lastRequestedAt: new Date(),
                            status: 'pending'
                        }, { merge: true });
                        opsInBatch++;
                    }
                    successCount++;
                }));

                if (opsInBatch > 0) {
                    await batch.commit();
                }
            }

            let msg = `${successCount} itens processados.`;
            if (alreadyExistsCount > 0) msg += ` (${alreadyExistsCount} já tinham imagem e foram pulados)`;
            setBulkMessage({ type: 'success', text: msg });
            setBulkText('');
            fetchProducts();

        } catch (error: any) {
            console.error(error);
            setBulkMessage({ type: 'error', text: 'Erro ao processar: ' + error.message });
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Tem certeza que deseja remover ${selectedProducts.length} itens do seu mapeamento?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedProducts.forEach(ean => {
                const mappingId = `${userData!.companyId}_${ean}`;
                batch.delete(doc(db, 'product_mappings', mappingId));
            });
            await batch.commit();
            setSelectedProducts([]);
            fetchProducts();
        } catch (error) {
            console.error("Error deleting items:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentCompanyName = () => {
        const membership = userData?.memberships?.find(m => m.companyId === userData.companyId);
        return membership?.companyName || 'Sua Empresa';
    };

    // Pagination Logic
    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = products.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="fade-in">
            <h1 className="title" style={{ marginBottom: '1.5rem' }}>Banco de Imagens Relacional</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', alignItems: 'start' }}>

                {/* Left Panel: Register Codes */}
                <div className="glass-card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Cadastrar Códigos</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Cole aqui a relação de códigos. Formato: <br />
                        <code style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px' }}>CÓDIGO DESCRIÇÃO EAN</code>
                    </p>

                    <textarea
                        className="form-input"
                        rows={10}
                        placeholder="Exemplo:
52282 BEBIDA HEINEKEN 78935495
1020 COCA COLA 2L 7894900011517"
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        style={{ fontFamily: 'monospace', marginBottom: '1rem', fontSize: '0.85rem' }}
                    />

                    {bulkMessage && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: bulkMessage.type === 'success' ? 'rgba(5, 205, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: bulkMessage.type === 'success' ? 'var(--success-color)' : 'var(--error-color)'
                        }}>
                            {bulkMessage.text}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={handleBulkImport}
                        disabled={bulkLoading}
                    >
                        {bulkLoading ? <Loader2 className="loading-spinner" /> : 'Processar Lista'}
                    </button>
                </div>

                {/* Right Panel: Mappings Table */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Mapeamentos Atuais</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {products.length} itens encontrados
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {selectedProducts.length > 0 && (
                                <button className="btn-secondary" style={{ color: 'var(--error-color)', borderColor: 'var(--error-color)' }} onClick={handleBulkDelete}>
                                    <Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Excluir ({selectedProducts.length})
                                </button>
                            )}
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                <Plus size={16} /> Novo
                            </button>
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                    <th style={{ padding: '1rem', width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedProducts(products.map(p => p.ean));
                                                else setSelectedProducts([]);
                                            }}
                                            checked={products.length > 0 && selectedProducts.length === products.length}
                                        />
                                    </th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Imagem</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrição / EAN</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cód. Interno</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map((product) => (
                                    <tr key={product.ean} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedProducts.includes(product.ean)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedProducts([...selectedProducts, product.ean]);
                                                    else setSelectedProducts(selectedProducts.filter(id => id !== product.ean));
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ width: '48px', height: '48px', margin: '0 auto', background: '#f8fafc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                <img
                                                    src={product.imageUrl || `https://imagens.canvazap.com.br/codbarras/${product.ean}.png`}
                                                    alt={product.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        // Try secondary source if not already tried
                                                        if (!target.src.includes('cdn-cosmos.bluesoft.com.br')) {
                                                            target.src = `https://cdn-cosmos.bluesoft.com.br/products/${product.ean}`;
                                                        } else {
                                                            target.style.display = 'none';
                                                            target.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{product.name || 'Sem descrição'}</div>
                                            <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{product.ean}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                background: 'rgba(5, 205, 153, 0.1)',
                                                color: 'var(--success-color)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                fontFamily: 'monospace'
                                            }}>
                                                {product.internalCode || '-'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '6px', width: '32px', height: '32px', margin: '0 auto' }}
                                                onClick={() => {
                                                    setNewEan(product.ean);
                                                    setNewName(product.name);
                                                    setNewInternalCode(product.internalCode || '');
                                                    setShowModal(true);
                                                }}
                                            >
                                                <Edit size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {products.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            Nenhum produto encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {products.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, products.length)} de {products.length}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        style={{ padding: '0.4rem 0.8rem' }}
                                    >
                                        Anterior
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                        Pág. {currentPage} of {totalPages}
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        style={{ padding: '0.4rem 0.8rem' }}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '500px', margin: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem' }}>Adicionar Novo Produto</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✖</button>
                        </div>

                        {addError && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={16} /> {addError}
                            </div>
                        )}

                        <form onSubmit={handleAddProduct}>
                            <div className="form-group">
                                <label className="form-label">Código EAN (Universal)</label>
                                <div style={{ position: 'relative' }}>
                                    <Barcode size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ paddingLeft: '2.5rem' }}
                                        placeholder="Ex: 7891234567890"
                                        value={newEan}
                                        onChange={(e) => setNewEan(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Nome do Produto</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ex: Coca-Cola 350ml"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Seu Código Interno (Opcional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ex: 101"
                                    value={newInternalCode}
                                    onChange={(e) => setNewInternalCode(e.target.value)}
                                />
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Isso vinculará este produto ao seu sistema.</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Imagem do Produto</label>
                                <div
                                    style={{
                                        border: '2px dashed var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '2rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        backgroundColor: newImage ? 'rgba(5, 205, 153, 0.05)' : 'transparent'
                                    }}
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                >
                                    {newImage ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)' }}>
                                            <Check size={32} />
                                            <span>{newImage.name}</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                            <Upload size={32} />
                                            <span>Clique para selecionar uma imagem</span>
                                        </div>
                                    )}
                                    <input
                                        id="file-upload"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => e.target.files && setNewImage(e.target.files[0])}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploading}>
                                {uploading ? <Loader2 className="loading-spinner" /> : 'Salvar Produto'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageBankModule;
