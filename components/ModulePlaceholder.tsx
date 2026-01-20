
import React from 'react';

interface ModuleProps {
    title: string;
}

const ModulePlaceholder: React.FC<ModuleProps> = ({ title }) => {
    return (
        <div className="fade-in">
            <h2 className="title" style={{ marginBottom: '1.5rem' }}>{title}</h2>
            <div className="glass-card" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '3rem', opacity: 0.2 }}>🚧</div>
                <p style={{ color: 'var(--text-muted)' }}>Módulo em construção</p>
            </div>
        </div>
    );
};

export default ModulePlaceholder;
