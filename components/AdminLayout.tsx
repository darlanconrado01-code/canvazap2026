
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AdminSidebar from './AdminSidebar';
import TopBar from './TopBar';

const AdminLayout = () => {
    const { userData, loading } = useAuth();

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
        </div>
    );

    // Strictly enforce Super Admin access
    if (userData?.role !== 'super_admin') {
        return <Navigate to="/" replace />;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-color)' }}>
            <AdminSidebar />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <TopBar />
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
