
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export interface CompanyMembership {
    companyId: string;
    role: 'admin' | 'member';
    status: 'active' | 'pending';
    allowedModules?: string[];
    companyName?: string; // Optional cached name
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

    // Computed properties based on current context (for backward compatibility)
    companyId?: string | null;
    role?: 'admin' | 'member' | null;
    status?: 'active' | 'pending' | null;
    allowedModules?: string[] | null;
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
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const rawData = userDoc.data();

                // BACKWARD COMPATIBILITY & MIGRATION ON READ
                // If old structure (flat companyId) exists but no memberships, convert on the fly for state
                let memberships: CompanyMembership[] = rawData.memberships || [];

                // If legacy data exists and not yet in memberships, add it
                if (!memberships.length && rawData.companyId) {
                    memberships.push({
                        companyId: rawData.companyId,
                        role: rawData.role || 'member',
                        status: rawData.status || 'active',
                        allowedModules: rawData.allowedModules || []
                    });
                }

                // Determine Active Context
                // Use stored currentCompanyId, or fallback to first membership, or legacy companyId
                const currentCompanyId = rawData.currentCompanyId || rawData.companyId || (memberships.length > 0 ? memberships[0].companyId : null);

                // Find active membership details
                const activeMembership = memberships.find(m => m.companyId === currentCompanyId);

                const finalUserData: UserData = {
                    uid: uid,
                    email: rawData.email,
                    displayName: rawData.displayName,
                    photoUrl: rawData.photoUrl,
                    phone: rawData.phone,
                    city: rawData.city,
                    memberships: memberships,
                    currentCompanyId: currentCompanyId,

                    // Computed context fields
                    companyId: currentCompanyId,
                    role: activeMembership ? activeMembership.role : null,
                    status: activeMembership ? activeMembership.status : null,
                    allowedModules: activeMembership ? activeMembership.allowedModules : null
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
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await fetchUserData(currentUser.uid);
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.uid);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, refreshUserData, switchCompany }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
