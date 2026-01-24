
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { MODULES } from './SidebarMenu';

export interface CompanyMembership {
    companyId: string;
    role: 'admin' | 'member';
    status: 'active' | 'pending';
    allowedModules?: string[];
    companyName?: string; // Optional cached name
    isOwner?: boolean;
}

interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    city?: string | null;

    // Multi-tenant support
    memberships?: CompanyMembership[];
    currentCompanyId?: string | null;
    isSystemAdmin?: boolean; // New field for system admins

    // Computed properties based on current context (for backward compatibility)
    companyId?: string | null;
    role?: 'admin' | 'member' | 'super_admin' | null;
    status?: 'active' | 'pending' | null;
    allowedModules?: string[] | null;
    companyModules?: string[]; // Modules enabled for the company
    isOwner?: boolean;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    initError: any | null;
    refreshUserData: () => Promise<void>;
    switchCompany: (companyId: string) => Promise<void>;
    impersonateUser: (uid: string) => Promise<void>;
    stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    refreshUserData: async () => { },
    switchCompany: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [impersonatedData, setImpersonatedData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<any | null>(null);

    const fetchUserData = async (uid: string) => {
        const authUser = auth.currentUser;
        const authEmail = authUser?.email?.toLowerCase() || '';

        // --- 0. SUPER ADMIN FOOLPROOF CHECK ---
        const isHardcodedAdmin = authEmail === 'darlanconrado01@gmail.com' || authEmail === 'darlanconrado@yahoo.com';
        const superAdminModules = ['dashboard', 'usuarios', 'empresas', 'laminas', 'artes-vagas', 'banco-imagens', 'encartes'];

        console.log('🔍 [AuthContext] Iniciando (UID:', uid, 'Email:', authEmail, 'Admin:', isHardcodedAdmin, ')');

        // BYPASS IMEDIATO PARA ADMIN: Não esperamos o Firestore se for do time CORE
        if (isHardcodedAdmin) {
            console.log('⚡ [AuthContext] MASTER BYPASS ATIVADO para:', authEmail);
            setUserData({
                uid,
                email: authEmail,
                displayName: authUser?.displayName || 'Master Admin',
                role: 'super_admin',
                isSystemAdmin: true,
                status: 'active',
                allowedModules: superAdminModules,
                companyModules: superAdminModules,
                memberships: [],
                isOwner: true
            } as any);
            setLoading(false); // Libera o Router imediatamente
        }

        try {
            const userDocRef = doc(db, 'users', uid);
            let userDocSnap: any = null;

            // Stage 1: Basic user doc fetch with timeout
            try {
                userDocSnap = await Promise.race([
                    getDoc(userDocRef),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Firebase')), 5000))
                ]);
            } catch (e: any) {
                console.error('❌ [AuthContext] FIRESTORE ERROR (user doc):', {
                    code: e?.code,
                    message: e?.message,
                    path: `users/${uid}`,
                    uid: auth.currentUser?.uid,
                    email: auth.currentUser?.email,
                });
            }

            let userDataFromDb: any = userDocSnap?.exists() ? userDocSnap.data() : { memberships: [] };

            // --- Stage 2: Company Fallbacks ---
            let memberships: CompanyMembership[] = Array.isArray(userDataFromDb.memberships) ? [...userDataFromDb.memberships] : [];

            const timeoutFetch = (p: Promise<any>) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))]);

            // Fallback 1: Direct find by ownerId (UID)
            try {
                const qOwner = query(collection(db, 'companies'), where('ownerId', '==', uid));
                const ownerSnap = await timeoutFetch(getDocs(qOwner));
                ownerSnap.forEach((d: any) => {
                    if (!memberships.some(m => m.companyId === d.id)) {
                        memberships.push({
                            companyId: d.id, role: 'admin', status: 'active', companyName: d.data().name, isOwner: true
                        });
                    }
                });
            } catch (e: any) {
                console.error('❌ [AuthContext] FIRESTORE ERROR (Fallback 1 UID):', {
                    code: e?.code,
                    message: e?.message,
                    query: "companies where ownerId == uid",
                    uid: auth.currentUser?.uid
                });
            }

            // Fallback 2: Direct find by owner email
            if (memberships.length === 0 && authEmail) {
                try {
                    const qEmail = query(collection(db, 'companies'), where('email', '==', authEmail));
                    const emailSnap = await timeoutFetch(getDocs(qEmail));
                    emailSnap.forEach((d: any) => {
                        memberships.push({
                            companyId: d.id, role: 'admin', status: 'active', companyName: d.data().name, isOwner: true
                        });
                    });
                } catch (e: any) { console.error('❌ [AuthContext] Fallback 2 (Email) falhou:', e.code || e.message); }
            }

            // Fallback 2.5: Find by memberUids array (New Standard)
            try {
                const qMembers = query(collection(db, 'companies'), where('memberUids', 'array-contains', uid));
                const memberSnap = await timeoutFetch(getDocs(qMembers));
                memberSnap.forEach((d: any) => {
                    if (!memberships.some(m => m.companyId === d.id)) {
                        memberships.push({
                            companyId: d.id, role: 'member', status: 'active', companyName: d.data().name
                        });
                    }
                });
            } catch (e: any) { console.error('❌ [AuthContext] Fallback 2.5 (memberUids) falhou:', e.code || e.message); }

            // Fallback 3: Search other accounts with same email (UID mismatch recovery)
            if (memberships.length === 0 && authEmail) {
                try {
                    const qOther = query(collection(db, 'users'), where('email', '==', authEmail));
                    const otherSnap = await timeoutFetch(getDocs(qOther));
                    otherSnap.forEach((uDoc: any) => {
                        if (uDoc.id !== uid) {
                            const otherData = uDoc.data();
                            if (Array.isArray(otherData.memberships)) {
                                otherData.memberships.forEach((m: any) => {
                                    if (!memberships.some(item => item.companyId === m.companyId)) memberships.push(m);
                                });
                            }
                        }
                    });
                } catch (e: any) { console.error('❌ [AuthContext] Fallback 3 (Cross) falhou:', e.code || e.message); }
            }

            // --- Stage 3: Resolve Context ---
            let activeCompanyId = userDataFromDb.currentCompanyId || userDataFromDb.companyId || (memberships.length > 0 ? memberships[0].companyId : null);

            if (activeCompanyId && !memberships.some(m => m.companyId === activeCompanyId) && memberships.length > 0) {
                activeCompanyId = memberships[0].companyId;
            }

            let activeMembership = memberships.find(m => m.companyId === activeCompanyId);
            let isOwner = activeMembership?.isOwner || false;
            let companyModules: string[] = [];

            if (activeCompanyId) {
                try {
                    const companySnap = await timeoutFetch(getDoc(doc(db, 'companies', activeCompanyId)));
                    if (companySnap.exists()) {
                        const cData = companySnap.data();
                        isOwner = isOwner || cData.ownerId === uid || cData.ownerId === authEmail;
                        companyModules = cData.modules || [];
                        if (activeMembership && !activeMembership.companyName) activeMembership.companyName = cData.name;
                    }
                } catch (e) { console.warn('⚠️ [AuthContext] Stage 3 (CompanyDetails) falhou ou timeout.'); }
            }

            // --- Stage 4: Set State ---
            const finalUserData: UserData = {
                uid: uid,
                email: authEmail || userDataFromDb.email || null,
                displayName: userDataFromDb.displayName || authUser?.displayName || 'Usuário',
                photoUrl: userDataFromDb.photoUrl || authUser?.photoURL || null,
                memberships: memberships,
                currentCompanyId: activeCompanyId,
                isSystemAdmin: isHardcodedAdmin,
                companyId: activeCompanyId,
                role: (isHardcodedAdmin ? 'super_admin' : (activeMembership?.role || userDataFromDb.role || 'member')) as any,
                status: (isHardcodedAdmin ? 'active' : (activeMembership?.status || userDataFromDb.status || 'active')) as any,
                allowedModules: isHardcodedAdmin ? superAdminModules : (activeMembership?.allowedModules || userDataFromDb.allowedModules || []),
                companyModules: isHardcodedAdmin ? superAdminModules : companyModules,
                isOwner: isHardcodedAdmin ? true : isOwner
            };

            // Force super_admin for master emails regardless of what Firestore says
            if (isHardcodedAdmin) {
                finalUserData.role = 'super_admin';
                finalUserData.isSystemAdmin = true;
                finalUserData.status = 'active';
            }

            // Reparar banco: se doc não existe ou mudou, atualiza
            if (!userDocSnap?.exists() || memberships.length !== (userDataFromDb.memberships?.length || 0)) {
                await setDoc(userDocRef, {
                    uid: uid,
                    email: finalUserData.email,
                    displayName: finalUserData.displayName,
                    memberships: finalUserData.memberships,
                    currentCompanyId: finalUserData.currentCompanyId,
                    isSystemAdmin: finalUserData.isSystemAdmin,
                    role: finalUserData.role,
                    updatedAt: new Date()
                }, { merge: true }).catch(() => { });
            }

            console.log('🚀 [AuthContext] Resumo:', { email: finalUserData.email, companies: memberships.length });

            // Perform Sanity Check (Diagnostic for all users)
            runSanityCheck();

            setUserData(finalUserData);
        } catch (error: any) {
            console.error("🔴 [AuthContext] ERRO FATAL:", error);
            setInitError(error);
            if (isHardcodedAdmin) {
                setUserData({
                    uid, email: authEmail, role: 'super_admin', isSystemAdmin: true, status: 'active',
                    companyModules: superAdminModules, allowedModules: superAdminModules, memberships: []
                } as any);
            }
        }
    };

    // --- Impersonation Logic ---
    const impersonateUser = async (targetUid: string) => {
        if (!userData?.isSystemAdmin) return;

        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', targetUid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const rawData = userDoc.data();

                // Fetch company data for the target user
                let memberships = rawData.memberships || [];
                const currentCompanyId = rawData.currentCompanyId || rawData.companyId || (memberships.length > 0 ? memberships[0].companyId : null);
                const activeMembership = memberships.find((m: any) => m.companyId === currentCompanyId);

                let isOwner = false;
                let companyModules: string[] = [];
                if (currentCompanyId) {
                    const companyDoc = await getDoc(doc(db, 'companies', currentCompanyId));
                    if (companyDoc.exists()) {
                        const companyData = companyDoc.data();
                        isOwner = companyData.ownerId === targetUid;
                        companyModules = companyData.modules || [];
                    }
                }

                const finalTargetData: UserData = {
                    uid: targetUid,
                    email: rawData.email,
                    displayName: rawData.displayName,
                    photoUrl: rawData.photoUrl,
                    phone: rawData.phone,
                    city: rawData.city,
                    memberships: memberships,
                    currentCompanyId: currentCompanyId,
                    isSystemAdmin: !!rawData.isSystemAdmin,
                    companyId: currentCompanyId,
                    role: (activeMembership ? activeMembership.role : (rawData.role || 'member')) as any,
                    status: (activeMembership ? activeMembership.status : (rawData.status || 'active')) as any,
                    allowedModules: activeMembership ? activeMembership.allowedModules : (rawData.allowedModules || []),
                    companyModules: companyModules,
                    isOwner: isOwner
                };

                setImpersonatedData(finalTargetData);
                sessionStorage.setItem('impersonatedUid', targetUid);
            }
        } catch (err) {
            console.error("Failed to impersonate:", err);
        } finally {
            setLoading(false);
        }
    };

    const stopImpersonation = () => {
        setImpersonatedData(null);
        sessionStorage.removeItem('impersonatedUid');
    };

    const switchCompany = async (targetCompanyId: string) => {
        const isImpersonating = !!impersonatedData;
        const targetUid = isImpersonating ? impersonatedData.uid : user?.uid;

        console.log('🔄 [AuthContext] Switching company to:', targetCompanyId, 'for UID:', targetUid, 'Impersonating:', isImpersonating);

        if (!targetUid) return;

        setLoading(true);
        try {
            // Use setDoc with merge to ensure doc existence
            await setDoc(doc(db, 'users', targetUid), {
                currentCompanyId: targetCompanyId
            }, { merge: true });

            if (isImpersonating) {
                // If impersonating, we need to refresh the impersonated context
                await impersonateUser(targetUid);
            } else {
                // Otherwise refresh own data
                await fetchUserData(targetUid);
            }
            console.log('✅ [AuthContext] Company switched successfully');
        } catch (err) {
            console.error('❌ [AuthContext] Error switching company:', err);
            alert('Erro ao trocar de empresa. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    const runSanityCheck = async () => {
        if (!auth.currentUser) return;
        console.log("🛠️ STARTING SANITY CHECK...");

        try {
            // 2.1 – Ler doc do próprio usuário (users/{uid})
            const userRef = doc(db, "users", auth.currentUser.uid);
            const snap = await getDoc(userRef);
            console.log("SANITY user doc exists?", snap.exists(), snap.data());

            // 2.2 – Listar 1 empresa (companies limit 1)
            const q = query(collection(db, "companies"), limit(1));
            const res = await getDocs(q);
            console.log("SANITY companies size:", res.size, res.docs.map(d => ({ id: d.id, ...d.data() })));

            // 2.3 – Listar 1 usuário (users limit 1)
            const uq = query(collection(db, "users"), limit(1));
            const ures = await getDocs(uq);
            console.log("SANITY users size:", ures.size);
        } catch (e: any) {
            console.error("SANITY CHECK FAILED:", {
                code: e?.code,
                message: e?.message,
                uid: auth.currentUser?.uid
            });
        }
    };

    useEffect(() => {
        let isMounted = true;
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('Auth initialization safety timeout reached.');
                setLoading(false);
            }
        }, 8000); // Reduced to 8s

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);

            if (currentUser) {
                try {
                    await fetchUserData(currentUser.uid);

                    const savedImpUid = sessionStorage.getItem('impersonatedUid');
                    if (savedImpUid) {
                        setTimeout(() => isMounted && impersonateUser(savedImpUid), 500);
                    }
                } catch (e) {
                    console.error("Auth init error:", e);
                }
            } else {
                setUserData(null);
            }

            if (isMounted) {
                clearTimeout(safetyTimeout);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            unsubscribe();
        };
    }, []);

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.uid);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            userData: impersonatedData || userData,
            loading,
            initError,
            refreshUserData,
            switchCompany,
            impersonateUser,
            stopImpersonation
        }}>
            {loading ? (
                <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};
