
import React, { useState } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Phone, MapPin, Image as ImageIcon, ArrowLeft } from 'lucide-react';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    // Login/Register Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [city, setCity] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');

    // Forgot Password State
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    // Reset States when switching modes
    const switchMode = (mode: 'login' | 'register' | 'forgot') => {
        setError('');
        setResetMessage('');
        if (mode === 'forgot') {
            setShowForgotPassword(true);
            setResetEmail(email); // Pre-fill if user typed in login
        } else if (mode === 'register') {
            setShowForgotPassword(false);
            setIsLogin(false);
        } else {
            setShowForgotPassword(false);
            setIsLogin(true);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail) {
            setError('Digite seu e-mail para recuperar a senha.');
            return;
        }

        setError('');
        setResetMessage('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, resetEmail);
            setResetMessage(`E-mail enviado para ${resetEmail}! Verifique sua caixa de entrada (e spam) para redefinir a senha.`);
        } catch (err: any) {
            console.error('Erro reset senha:', err);
            if (err.code === 'auth/user-not-found') {
                setError('E-mail não encontrado no sistema.');
            } else if (err.code === 'auth/invalid-email') {
                setError('E-mail inválido.');
            } else {
                setError('Erro ao enviar e-mail. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                console.log('🔵 Iniciando registro...', { name, email });

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('✅ Usuário criado no Auth:', userCredential.user.uid);

                // Update Firebase Auth profile FIRST
                await updateProfile(userCredential.user, {
                    displayName: name,
                    photoURL: photoUrl || null
                });
                console.log('✅ Profile atualizado no Auth');

                // Force reload to get updated profile
                await userCredential.user.reload();
                console.log('✅ User reloaded, displayName:', userCredential.user.displayName);

                // Create initial user doc in Firestore with explicit values
                const userData = {
                    uid: userCredential.user.uid,
                    email: email, // Use the form value directly
                    displayName: name, // Use the form value directly
                    phone: phone || null,
                    city: city || null,
                    photoUrl: photoUrl || null,
                    companyId: null,
                    role: null,
                    status: null,
                    createdAt: new Date()
                };

                console.log('📝 Criando documento no Firestore:', userData);

                await setDoc(doc(db, 'users', userCredential.user.uid), userData);
                console.log('✅ Documento criado no Firestore');

                // Small delay to ensure Firestore processes the write
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Check if there is a 'from' state or a search param in the 'from'
            const targetPath = location.state?.from
                ? `${location.state.from.pathname}${location.state.from.search}`
                : '/';

            navigate(targetPath, { replace: true });

        } catch (err: any) {
            console.error('❌ Erro no registro:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
            } else if (err.code === 'auth/invalid-credential') {
                setError('E-mail ou senha inválidos.');
            } else if (err.code === 'auth/operation-not-allowed') {
                setError('Erro: O provedor de E-mail/Senha está desativado no Console do Firebase.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Muitas tentativas falhas. Tente novamente mais tarde.');
            } else {
                setError(`Erro técnico: [${err.code}] ${err.message}`);
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card fade-in" style={{ maxWidth: (!isLogin && !showForgotPassword) ? '500px' : '440px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 className="title">EcoD3</h1>
                    <p className="subtitle">
                        {showForgotPassword ? 'Recuperação de Senha' :
                            isLogin ? 'Bem-vindo de volta! Acesse sua conta.' : 'Crie sua conta e comece agora.'}
                    </p>
                </div>

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

                {resetMessage && (
                    <div style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        border: '1px solid #22c55e',
                        color: '#4ade80',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem'
                    }}>
                        {resetMessage}
                    </div>
                )}

                {showForgotPassword ? (
                    /* FORGOT PASSWORD FORM */
                    <form onSubmit={handleForgotPassword}>
                        <div className="form-group">
                            <label className="form-label">Digite seu e-mail</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="email"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="seu@email.com"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 className="loading-spinner" /> : (
                                <>
                                    Enviar E-mail de Recuperação
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <button
                                type="button"
                                onClick={() => switchMode('login')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ArrowLeft size={16} />
                                Voltar para o Login
                            </button>
                        </div>
                    </form>
                ) : (
                    /* LOGIN / REGISTER FORM */
                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Nome Completo</label>
                                    <div style={{ position: 'relative' }}>
                                        <UserIcon size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: '2.5rem' }}
                                            placeholder="Seu nome"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <div style={{ position: 'relative' }}>
                                            <Phone size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                            <input
                                                type="tel"
                                                className="form-input"
                                                style={{ paddingLeft: '2.5rem' }}
                                                placeholder="(00) 00000-0000"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
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
                                                placeholder="Sua cidade"
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)}
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
                                            placeholder="https://..."
                                            value={photoUrl}
                                            onChange={(e) => setPhotoUrl(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label className="form-label">E-mail</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="email"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="password"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="******"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {isLogin && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', marginTop: '-0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => switchMode('forgot')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Esqueceu a senha?
                                </button>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 className="loading-spinner" /> : (
                                <>
                                    {isLogin ? 'Entrar' : 'Criar Conta'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {!showForgotPassword && (
                        <>
                            {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
                            <button
                                onClick={() => switchMode(isLogin ? 'register' : 'login')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary-color)',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {isLogin ? 'Registre-se' : 'Faça Login'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
