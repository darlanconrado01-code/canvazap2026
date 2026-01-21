
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
    refreshUserData: () => Promise<void>;
    switchCompany: (companyId: string) => Promise<void>;
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
    const [loading, setLoading] = useState(true);

    const fetchUserData = async (uid: string) => {
        try {
            const userDocRef = doc(db, 'users', uid);
            // 1. Check if it's a Super Admin RIGHT NOW based on Auth Email
            // This prevents loops if the Firestore document doesn't exist yet
            const authEmail = auth.currentUser?.email?.toLowerCase();
            const isHardcodedAdmin = authEmail === 'darlanconrado01@gmail.com';
            const superAdminModules = ['dashboard', 'usuarios', 'empresas'];

            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const rawData = userDoc.data();

                // ... (rest of the logic for existing docs)
                let memberships: CompanyMembership[] = rawData.memberships || [];
                if (!memberships.length && rawData.companyId) {
                    memberships.push({
                        companyId: rawData.companyId,
                        role: rawData.role || 'member',
                        status: rawData.status || 'active',
                        allowedModules: rawData.allowedModules || []
                    });
                }

                const currentCompanyId = rawData.currentCompanyId || rawData.companyId || (memberships.length > 0 ? memberships[0].companyId : null);
                const activeMembership = memberships.find(m => m.companyId === currentCompanyId);

                let isOwner = false;
                let companyModules: string[] = [];
                if (currentCompanyId) {
                    const companyDoc = await getDoc(doc(db, 'companies', currentCompanyId));
                    if (companyDoc.exists()) {
                        const companyData = companyDoc.data();
                        isOwner = companyData.ownerId === uid;
                        companyModules = companyData.modules || [];
                    }
                }

                const isSuperAdmin = rawData.isSystemAdmin || isHardcodedAdmin;

                // Ensure we always have email and displayName
                const userEmail = rawData.email || auth.currentUser?.email || null;
                const userDisplayName = rawData.displayName || auth.currentUser?.displayName || 'Usuário';
                const userPhotoUrl = rawData.photoUrl || auth.currentUser?.photoURL || null;

                const finalUserData: UserData = {
                    uid: uid,
                    email: userEmail,
                    displayName: userDisplayName,
                    photoUrl: userPhotoUrl,
                    phone: rawData.phone,
                    city: rawData.city,
                    memberships: memberships,
                    currentCompanyId: isSuperAdmin ? null : currentCompanyId,
                    isSystemAdmin: isSuperAdmin,
                    companyId: isSuperAdmin ? null : currentCompanyId,
                    role: isSuperAdmin ? 'super_admin' : (activeMembership ? activeMembership.role : null),
                    status: isSuperAdmin ? 'active' : (activeMembership ? activeMembership.status : 'active'),
                    allowedModules: isSuperAdmin ? superAdminModules : (activeMembership ? activeMembership.allowedModules : (rawData.isSystemAdmin ? [] : null)),
                    companyModules: isSuperAdmin ? superAdminModules : companyModules,
                    isOwner: isSuperAdmin ? false : isOwner
                };
                setUserData(finalUserData);
            } else if (isHardcodedAdmin) {
                // Handle Super Admin with NO Firestore doc yet
                const finalUserData: UserData = {
                    uid: uid,
                    email: authEmail || null,
                    displayName: auth.currentUser?.displayName || 'Admin Master',
                    isSystemAdmin: true,
                    role: 'super_admin',
                    status: 'active',
                    companyId: null,
                    allowedModules: superAdminModules,
                    companyModules: superAdminModules,
                    isOwner: false,
                    memberships: []
                };
                setUserData(finalUserData);
            } else {
                setUserData(null);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };

    const switchCompany = async (targetCompanyId: string) => {
        if (!user || !userData) return;

        // precise update to avoiding re-fetching lag
        setLoading(true); // fast visual feedback
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                currentCompanyId: targetCompanyId
            });
            await fetchUserData(user.uid);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Safety timeout - if auth doesn't respond in 10 seconds, stop loading
        const safetyTimeout = setTimeout(() => {
            console.warn('Auth initialization timeout - forcing loading to false');
            setLoading(false);
        }, 10000);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            clearTimeout(safetyTimeout);
            setUser(currentUser);
            if (currentUser) {
                await fetchUserData(currentUser.uid);
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => {
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
        <AuthContext.Provider value={{ user, userData, loading, refreshUserData, switchCompany }}>
            {loading ? (
                <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};
