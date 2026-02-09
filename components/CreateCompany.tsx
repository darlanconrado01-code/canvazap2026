
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, addDoc, updateDoc, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { Building, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

const CreateCompany = () => {
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, userData, refreshUserData } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (userData?.role === 'super_admin') {
            navigate('/admin', { replace: true });
        }
    }, [userData, navigate]);

    const generateCompanyCode = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user) return;
        setLoading(true);

        try {
            const companyId = crypto.randomUUID();
            const code = generateCompanyCode();

            // Create company document
            await setDoc(doc(db, 'companies', companyId), {
                id: companyId,
                name: companyName,
                code: code,
                ownerId: user.uid,
                memberUids: [user.uid], // Set as first member
                status: 'inactive', // Companies start inactive until activated by support
                createdAt: new Date(),
            });

            // Update user with company info - add as membership
            await setDoc(doc(db, 'users', user.uid), {
                memberships: arrayUnion({
                    companyId: companyId,
                    role: 'admin',
                    status: 'active',
                    companyName: companyName,
                    isOwner: true
                }),
                currentCompanyId: companyId // Switch context immediately
            }, { merge: true });

            await refreshUserData();
            navigate('/');
        } catch (error: any) {
            console.error("Error creating company:", error);
            if (error.code === 'permission-denied') {
                setError('Erro de permissão: Verifique as regras do Firestore no Console. (' + error.message + ')');
            } else {
                // Show the actual error message to help debug
                setError('Erro ao criar empresa: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card fade-in" style={{ maxWidth: '440px', width: '100%' }}>
                <button
                    onClick={() => navigate('/onboarding')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}
                >
                    <ArrowLeft size={16} /> Voltar
                </button>

                <h2 className="title" style={{ fontSize: '1.5rem' }}>Criar Nova Empresa</h2>
                <p className="subtitle">Dê um nome para sua organização.</p>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid var(--error-color)',
                        color: '#fca5a5',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nome da Empresa</label>
                        <div style={{ position: 'relative' }}>
                            <Building size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="Ex: Minha Agência Digital"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Loader2 className="loading-spinner" /> : (
                            <>
                                Criar e Acessar
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateCompany;
