
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit, Save, X, ChevronRight, Tags, CheckCircle2, AlertCircle } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    subcategories: string[];
}

const BusinessCategoriesModule = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [subInputs, setSubInputs] = useState<{ [key: string]: string }>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'business_categories'));
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim() || saving) return;

        setSaving(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'business_categories', editingId), {
                    name: categoryName
                });
                setNotification({ msg: 'Categoria atualizada!', type: 'success' });
            } else {
                await addDoc(collection(db, 'business_categories'), {
                    name: categoryName,
                    subcategories: []
                });
                setNotification({ msg: 'Categoria criada com sucesso!', type: 'success' });
            }
            setCategoryName('');
            setEditingId(null);
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            setNotification({ msg: 'Erro ao salvar categoria.', type: 'error' });
        } finally {
            setSaving(true);
            // Wait, I should set it to false. Typo in my head.
            setSaving(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('Excluir esta categoria e todas as suas subcategorias?')) return;
        try {
            await deleteDoc(doc(db, 'business_categories', id));
            setNotification({ msg: 'Categoria removida.', type: 'success' });
            fetchCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            setNotification({ msg: 'Erro ao excluir.', type: 'error' });
        }
    };

    const handleAddSubcategory = async (catId: string, currentSubs: string[]) => {
        const input = subInputs[catId];
        if (!input?.trim() || currentSubs.includes(input.trim()) || saving) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, 'business_categories', catId), {
                subcategories: [...currentSubs, input.trim()]
            });
            setSubInputs(prev => ({ ...prev, [catId]: '' }));
            setNotification({ msg: 'Subcategoria adicionada!', type: 'success' });
            fetchCategories();
        } catch (error) {
            console.error("Error adding subcategory:", error);
            setNotification({ msg: 'Erro ao adicionar subcategoria.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSubcategory = async (catId: string, subName: string, currentSubs: string[]) => {
        try {
            await updateDoc(doc(db, 'business_categories', catId), {
                subcategories: currentSubs.filter(s => s !== subName)
            });
            fetchCategories();
        } catch (error) {
            console.error("Error removing subcategory:", error);
        }
    };

    return (
        <div className="fade-in">
            {notification && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', padding: '1rem 2rem',
                    borderRadius: '8px', background: notification.type === 'success' ? '#22c55e' : '#ef4444',
                    color: 'white', zIndex: 1000, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {notification.msg}
                </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
                <h1 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <Tags size={28} color="var(--primary-color)" /> Configuração de Categorias de Negócio
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Gerencie as categorias e subcategorias que as empresas podem selecionar em seu perfil.</p>
            </div>

            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: Supermercado, Açougue..."
                        value={categoryName}
                        onChange={e => setCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
                        disabled={saving}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveCategory}
                        style={{ whiteSpace: 'nowrap' }}
                        disabled={saving || !categoryName.trim()}
                    >
                        {saving ? <div className="loading-spinner" style={{ width: 16, height: 16, borderTopColor: 'white' }}></div> : (editingId ? <Save size={18} /> : <Plus size={18} />)} {editingId ? 'Salvar Nome' : 'Criar Categoria'}
                    </button>
                    {editingId && <button className="btn btn-secondary" onClick={() => { setEditingId(null); setCategoryName(''); }} disabled={saving}><X size={18} /></button>}
                </div>
            </div>

            {loading ? (
                <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {categories.map(cat => (
                        <div key={cat.id} className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ margin: 0 }}>{cat.name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-icon" onClick={() => { setEditingId(cat.id); setCategoryName(cat.name); }}><Edit size={16} /></button>
                                    <button className="btn-icon" style={{ color: 'red' }} onClick={() => handleDeleteCategory(cat.id)}><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {(cat.subcategories || []).map(sub => (
                                        <span key={sub} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-color)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                                            {sub}
                                            <X size={14} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => handleRemoveSubcategory(cat.id, sub, cat.subcategories)} />
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ height: '32px', fontSize: '0.85rem' }}
                                        placeholder="Nova subcategoria..."
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleAddSubcategory(cat.id, cat.subcategories);
                                        }}
                                        onChange={e => setSubInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                        value={subInputs[cat.id] || ''}
                                        disabled={saving}
                                    />
                                    <button
                                        className="btn btn-secondary"
                                        style={{ height: '32px', padding: '0 10px' }}
                                        onClick={() => handleAddSubcategory(cat.id, cat.subcategories)}
                                        disabled={saving || !(subInputs[cat.id] || '').trim()}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BusinessCategoriesModule;
