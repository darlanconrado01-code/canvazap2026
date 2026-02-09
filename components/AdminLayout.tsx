
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AdminSidebar from './AdminSidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { LayoutProvider, useLayout } from './LayoutContext';

const AdminLayoutContent = () => {
    const { isSidebarOpen, setSidebarOpen } = useLayout();

    return (
        <div className="app-container">
            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <AdminSidebar />

            <div className="main-wrapper">
                <main className="main-content">
                    <div className="content-container">
                        <TopBar />
                        <Outlet />
                    </div>
                </main>
            </div>

            <BottomNav />
        </div>
    );
};

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
        <LayoutProvider>
            <AdminLayoutContent />
        </LayoutProvider>
    );
};

export default AdminLayout;
