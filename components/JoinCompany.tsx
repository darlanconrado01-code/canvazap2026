
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { KeyRound, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { CompanyMembership } from './AuthContext';

const JoinCompany = () => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, userData, refreshUserData } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (userData?.role === 'super_admin') {
            navigate('/admin', { replace: true });
        }
    }, [userData, navigate]);
    const location = useLocation();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const codeParam = searchParams.get('code');
        if (codeParam) {
            setCode(codeParam);
        }
    }, [location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setError('');
        setLoading(true);

        try {
            // Find company by code
            const q = query(collection(db, 'companies'), where('code', '==', code.toUpperCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError('Código de empresa inválido. Verifique e tente novamente.');
                setLoading(false);
                return;
            }

            const companyDoc = querySnapshot.docs[0];
            const companyData = companyDoc.data();
            const companyId = companyDoc.id;

            // Check if already member
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data();

            const memberships: CompanyMembership[] = userData?.memberships || [];

            // Check if already in this company
            if (memberships.some(m => m.companyId === companyId) || userData?.companyId === companyId) {
                setError('Você já solicitou entrada ou participa desta empresa.');
                setLoading(false);
                return;
            }

            // Add new membership request
            const newMembership: CompanyMembership = {
                companyId: companyId,
                role: 'member',
                status: 'pending',
                companyName: companyData.name
            };

            await updateDoc(userDocRef, {
                memberships: arrayUnion(newMembership),
                // If it's the very first one, set as current context? 
                // Let's decide later. For now, we just add entitlement.
                // If user has NO current company, maybe set this one as current pending?
                ...(!userData?.currentCompanyId ? { currentCompanyId: companyId } : {})
            });

            await refreshUserData();
            setSuccess(`Solicitação enviada para ${companyData.name}! Aguarde a aprovação do administrador.`);

            // After a delay, maybe go to a "pending" screen or stay here
            setTimeout(() => {
                navigate('/');
            }, 3000);

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao processar sua solicitação.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="auth-container">
                <div className="glass-card fade-in" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)',
                        color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
                    }}>
                        <ArrowRight size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Solicitação Enviada!</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{success}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="glass-card fade-in">
                <button
                    onClick={() => navigate('/onboarding')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}
                >
                    <ArrowLeft size={16} /> Voltar
                </button>

                <h2 className="title" style={{ fontSize: '1.5rem' }}>Entrar em uma Empresa</h2>
                <p className="subtitle">Digite o código fornecido pelo administrador.</p>

                {error && (
                    <div style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Código da Empresa</label>
                        <div style={{ position: 'relative' }}>
                            <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="form-input"
                                style={{ paddingLeft: '2.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}
                                placeholder="Ex: X9Y2Z1"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                maxLength={6}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Loader2 className="loading-spinner" /> : (
                            <>
                                Entrar
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JoinCompany;
