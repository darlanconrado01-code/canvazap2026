
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useAuth } from './AuthContext';
import { LayoutProvider, useLayout } from './LayoutContext';

const AppLayoutContent = () => {
    const { isSidebarOpen, setSidebarOpen } = useLayout();

    return (
        <div className="app-container">
            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <Sidebar />

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

const AppLayout = () => {
    const { loading } = useAuth();
    if (loading) return null;

    return (
        <LayoutProvider>
            <AppLayoutContent />
        </LayoutProvider>
    );
};

export default AppLayout;
