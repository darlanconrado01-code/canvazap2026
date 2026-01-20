import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Building2, Save, Upload, MapPin, Phone, Globe, Mail } from 'lucide-react';

const CompanyProfile = () => {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        logoUrl: '',
        phone: '',
        email: '',
        address: '',
        website: '',
        description: '',
        color: '#2563eb' // Brand color
    });

    useEffect(() => {
        const fetchCompany = async () => {
            if (userData?.companyId) {
                try {
                    const docSnap = await getDoc(doc(db, 'companies', userData.companyId));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            name: data.name || '',
                            logoUrl: data.logoUrl || '',
                            phone: data.phone || '',
                            email: data.email || '',
                            address: data.address || '',
                            website: data.website || '',
                            description: data.description || '',
                            color: data.color || '#2563eb'
                        });
                    }
                } catch (error) {
                    console.error("Error fetching company:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchCompany();
    }, [userData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData?.companyId) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, 'companies', userData.companyId), {
                ...formData,
                updatedAt: new Date().toISOString()
            });
            alert('Dados da empresa atualizados com sucesso!');
        } catch (error) {
            console.error("Error saving company:", error);
            alert('Erro ao salvar dados.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Carregando...</div>;

    return (
        <div className="fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ padding: '0.8rem', background: 'var(--bg-color)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>Perfil da Empresa</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Gerencie as informações públicas e internas da sua organização.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Logo Section */}
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'start' }}>
                        <div style={{ width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', background: '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {formData.logoUrl ? (
                                <img src={formData.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Building2 size={40} color="#94a3b8" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>URL do Logo</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="https://..."
                                    value={formData.logoUrl}
                                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                                    style={{ flex: 1 }}
                                />
                                {/* Future: Upload Button */}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Cole o link direto para a imagem do seu logo (PNG ou JPG transparente recomendado).
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label className="form-label mb-2 block font-semibold">Nome da Empresa</label>
                            <input
                                type="text"
                                className="form-input w-full"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="form-label mb-2 block font-semibold flex items-center gap-2"><div style={{ width: 20, height: 20, borderRadius: 4, background: formData.color }}></div> Cor da Marca</label>
                            <input
                                type="color"
                                className="form-input w-full h-[42px] p-1"
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Phone size={16} /> Telefone / WhatsApp</label>
                            <input
                                type="text"
                                className="form-input w-full"
                                placeholder="(00) 00000-0000"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Mail size={16} /> Email de Contato</label>
                            <input
                                type="email"
                                className="form-input w-full"
                                placeholder="contato@empresa.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="form-label mb-2 block font-semibold flex items-center gap-2"><MapPin size={16} /> Endereço Completo</label>
                        <input
                            type="text"
                            className="form-input w-full"
                            placeholder="Rua, Número, Bairro, Cidade - UF"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="form-label mb-2 block font-semibold flex items-center gap-2"><Globe size={16} /> Site</label>
                        <input
                            type="text"
                            className="form-input w-full"
                            placeholder="https://www.suaempresa.com.br"
                            value={formData.website}
                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="form-label mb-2 block font-semibold">Descrição</label>
                        <textarea
                            className="form-input w-full"
                            rows={3}
                            placeholder="Breve descrição sobre a empresa..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}
                        >
                            <Save size={18} />
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CompanyProfile;
