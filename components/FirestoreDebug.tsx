
import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebaseConfig';
import { doc, getDoc, getDocs, collection, query, limit, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { AlertCircle, CheckCircle2, FlaskConical, Github, Database, UserCheck, Search, Activity } from 'lucide-react';

const FirestoreDebug = () => {
    const { userData } = useAuth();
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchUID, setSearchUID] = useState('lK0m19X8fGZkNozREj5L3Y5F8y42'); // Default to Pato for convenience

    const logResult = (name: string, status: 'ok' | 'error' | 'loading', message: string, data?: any) => {
        setResults(prev => {
            const index = prev.findIndex(r => r.name === name);
            const newRes = { name, status, message, data };
            if (index >= 0) {
                const updated = [...prev];
                updated[index] = newRes;
                return updated;
            }
            return [...prev, newRes];
        });
    };

    const runTests = async () => {
        setLoading(true);
        setResults([]);

        // --- TEST 0: AUTHORITY TEST ---
        logResult('0. Autoridade de Escrita', 'loading', 'Verificando permissão de escrita MASTER...');
        try {
            const { setDoc, doc } = await import('firebase/firestore');
            await setDoc(doc(db, 'system_checks', 'authority'), {
                lastCheck: new Date(),
                by: auth.currentUser?.email,
                uid: auth.currentUser?.uid
            });
            logResult('0. Autoridade de Escrita', 'ok', 'Sucesso! Você é reconhecido como ADMIN pelas Rules.');
        } catch (e: any) {
            logResult('0. Autoridade de Escrita', 'error', `BLOQUEADO: [${e.code}] - O Firestore não te deu poder de Admin.`);
        }

        // --- TEST 1: ENVIRONMENT ---
        logResult('A. Firebase Identity', 'loading', 'Verificando configuração vinculada...');
        try {
            // Get actual config from initialized app
            const actualConfig = {
                projectId: auth.app.options.projectId,
                authDomain: auth.app.options.authDomain,
                appId: auth.app.options.appId,
                apiKey: auth.app.options.apiKey?.substring(0, 10) + '...'
            };
            logResult('A. Firebase Identity', 'ok', `PROJETO: ${actualConfig.projectId}`, actualConfig);
        } catch (e: any) {
            logResult('A. Firebase Identity', 'error', `Falha ao ler config: ${e.message}`);
        }

        // --- TEST 2: CURRENT USER DOC ---
        if (auth.currentUser) {
            logResult('B. User Doc (users/{uid})', 'loading', 'Lendo documento do usuário logado...');
            try {
                const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (snap.exists()) {
                    logResult('B. User Doc (users/{uid})', 'ok', 'Documento encontrado corretamente no Firestore.', snap.data());
                } else {
                    logResult('B. User Doc (users/{uid})', 'error', 'Documento NÃO existe na coleção /users.');
                }
            } catch (e: any) {
                logResult('B. User Doc (users/{uid})', 'error', `ERRO: [${e.code}] ${e.message}`);
            }
        }

        // --- TEST 3: DATA EXISTENCE (COLLECTIONS) ---
        logResult('C. Collection: companies', 'loading', 'Verificando dados na coleção companies...');
        try {
            const q = query(collection(db, 'companies'), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                logResult('C. Collection: companies', 'ok', `Encontrada(s) ${snap.size} empresa(s).`, snap.docs[0].data());
            } else {
                logResult('C. Collection: companies', 'error', 'Coleção vazia ou sem acesso.');
            }
        } catch (e: any) {
            logResult('C. Collection: companies', 'error', `ERRO: [${e.code}] ${e.message}`);
        }

        logResult('D. Collection: users', 'loading', 'Verificando dados na coleção users...');
        try {
            const q = query(collection(db, 'users'), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                logResult('D. Collection: users', 'ok', `Encontrada(s) ${snap.size} usuário(s).`, snap.docs[0].data());
            } else {
                logResult('D. Collection: users', 'error', 'Coleção vazia ou sem acesso.');
            }
        } catch (e: any) {
            logResult('D. Collection: users', 'error', `ERRO: [${e.code}] ${e.message}`);
        }

        // --- TEST 4: COMPOSITE QUERIES (INDEX CHECK) ---
        logResult('E. Dashboard Stats Query', 'loading', 'Testando query de estatísticas...');
        try {
            // Test a likely composite query or count
            const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'), limit(5));
            const snap = await getDocs(q);
            logResult('E. Dashboard Stats Query', 'ok', `Query de histórico funcionou. Retornou ${snap.size} itens.`);
        } catch (e: any) {
            logResult('E. Dashboard Stats Query', 'error', `ERRO: [${e.code}] ${e.message}`);
        }

        // --- TEST 5: SPECIFIC CASE (MANUAL UID) ---
        logResult('F. Manual User Check', 'loading', `Verificando UID: ${searchUID}...`);
        try {
            const snap = await getDoc(doc(db, 'users', searchUID));
            if (snap.exists()) {
                const data = snap.data();
                const memberships = data.memberships || [];
                logResult('F. Manual User Check', 'ok', `Usuário encontrado: ${data.email || 'Sem email'}`, data);

                // If user has companyId, try to read that company too
                const compId = data.currentCompanyId || data.companyId;
                if (compId) {
                    try {
                        const cSnap = await getDoc(doc(db, 'companies', compId));
                        if (cSnap.exists()) {
                            const cData = cSnap.data();
                            const isMember = cData.memberUids?.includes(searchUID);
                            logResult(`F.1 Company Visibility (${compId})`, isMember ? 'ok' : 'error',
                                isMember ? 'Acesso OK: UID está na lista de membros.' : 'ERRO: UID NÃO está na lista memberUids da empresa.', cData);
                        } else {
                            logResult(`F.1 Company Visibility (${compId})`, 'error', 'Empresa vinculada ao usuário NÃO existe.');
                        }
                    } catch (ce: any) {
                        logResult(`F.1 Company Visibility (${compId})`, 'error', `Falha ao ler empresa: [${ce.code}] ${ce.message}`);
                    }
                }
            } else {
                logResult('F. Manual User Check', 'error', 'UID não encontrado na coleção /users.');
            }
        } catch (e: any) {
            logResult('F. Manual User Check', 'error', `ERRO: [${e.code}] ${e.message}`);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (userData?.role === 'super_admin') {
            runTests();
        }
    }, [userData]);

    if (userData?.role !== 'super_admin') {
        return <div className="p-8">Acesso negado. Apenas Master Admin.</div>;
    }

    return (
        <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <FlaskConical size={32} color="var(--primary-color)" />
                <div>
                    <h1 className="title" style={{ fontSize: '1.8rem', margin: 0 }}>Firestore Diagnostic Panel</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Validação profunda de regras, dados e conexão PROD.</p>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={20} /> Tests Runner
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>UID para Teste Individual:</span>
                            <input
                                type="text"
                                className="form-input"
                                style={{ width: '250px', fontSize: '0.8rem', padding: '0.4rem' }}
                                value={searchUID}
                                onChange={(e) => setSearchUID(e.target.value)}
                                placeholder="Insira o UID aqui..."
                            />
                        </div>
                        <button onClick={runTests} disabled={loading} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1.5rem' }}>
                            {loading ? 'Rodando...' : 'Re-executar Testes'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {results.map((res, i) => (
                        <div key={i} className="glass-card" style={{
                            padding: '1rem',
                            borderLeft: `4px solid ${res.status === 'ok' ? 'var(--success-color)' : res.status === 'error' ? 'var(--error-color)' : 'var(--primary-color)'}`,
                            background: 'rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{res.name}</div>
                                    <div style={{ fontSize: '1.1rem', marginTop: '0.2rem', color: res.status === 'error' ? 'var(--error-color)' : 'inherit' }}>
                                        {res.status === 'ok' ? <CheckCircle2 size={16} inline style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> :
                                            res.status === 'error' ? <AlertCircle size={16} inline style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> : null}
                                        {res.message}
                                    </div>
                                </div>
                            </div>
                            {res.data && (
                                <details style={{ marginTop: '1rem' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary-color)' }}>Ver detalhes (JSON)</summary>
                                    <pre style={{
                                        marginTop: '0.5rem',
                                        padding: '1rem',
                                        background: '#000',
                                        color: '#0f0',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        overflow: 'auto',
                                        maxHeight: '200px'
                                    }}>
                                        {JSON.stringify(res.data, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,0,0.2)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#F59E0B' }}>Guia de Resolução</h4>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <p>• <strong>PERMISSION_DENIED:</strong> Verifique as "Rules" no console do Firebase. Usuário pode não ser membro da empresa.</p>
                    <p>• <strong>FAILED_PRECONDITION:</strong> Geralmente significa falta de índice. O erro no console terá um link para criar.</p>
                    <p>• <strong>0 registros (OK):</strong> O banco está conectado mas vazio, ou as queries não batem com os dados.</p>
                </div>
            </div>
        </div>
    );
};

export default FirestoreDebug;
