
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from './AuthContext';

const AppLayout = () => {
    const { userData, loading } = useAuth();

    if (loading) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-color)' }}>
            <Sidebar />

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

export default AppLayout;
