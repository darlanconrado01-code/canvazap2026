
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { User, Phone, MapPin, Image as ImageIcon, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const { user, userData, refreshUserData } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [city, setCity] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (userData) {
            setDisplayName(userData.displayName || '');
            setPhone(userData.phone || '');
            setCity(userData.city || '');
            setPhotoUrl(userData.photoUrl || '');
        }
    }, [userData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setSuccess('');

        try {
            // Update Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                displayName,
                phone,
                city,
                photoUrl
            });

            // Update Auth Profile for generic display name and photo
            await updateProfile(user, {
                displayName: displayName,
                photoURL: photoUrl || null
            });

            await refreshUserData();
            setSuccess('Perfil atualizado com sucesso!');
        } catch (error) {
            console.error("Error updating profile:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <button
                onClick={() => navigate('/')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}
            >
                <ArrowLeft size={16} /> Voltar para Dashboard
            </button>

            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        backgroundImage: `url(${photoUrl || 'https://via.placeholder.com/150'})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        backgroundColor: 'var(--surface-color)', border: '2px solid var(--border-color)'
                    }}></div>
                    <div>
                        <h2 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>Meu Perfil</h2>
                        <p className="subtitle" style={{ margin: 0 }}>Gerencie suas informações pessoais.</p>
                    </div>
                </div>

                {success && (
                    <div className="fade-in" style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid var(--success-color)',
                        color: '#bbf7d0',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        <CheckCircle size={18} />
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nome Completo</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Telefone</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="tel"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Ex: São Paulo"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">URL da Foto de Perfil</label>
                        <div style={{ position: 'relative' }}>
                            <ImageIcon size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="url"
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={photoUrl}
                                onChange={(e) => setPhotoUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Loader2 className="loading-spinner" /> : 'Salvar Alterações'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Profile;
