import React, { useState } from 'react';
import type { TrelloUser } from './types';
import type { TrelloState } from './useTrello';

export default function ProfileSelector({ state }: { state: TrelloState }) {
    const { allUsers, enterAsUser } = state;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#F4F7FE',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{ position: 'absolute', top: 24, left: 32, fontSize: 28, fontWeight: 900, color: '#4318FF', letterSpacing: -1, fontStyle: 'italic', textTransform: 'uppercase' as const }}>
                D3
            </div>
            <h1 style={{ color: '#2B3674', fontSize: 42, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>
                Selecione seu perfil
            </h1>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' }}>
                {allUsers.map(user => (
                    <ProfileItem key={user.id} user={user} onClick={() => enterAsUser(user)} />
                ))}
            </div>
        </div>
    );
}

function ProfileItem({ user, onClick }: { user: TrelloUser; onClick: () => void }) {
    const [hover, setHover] = useState(false);
    const initials = user.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const isAdmin = user.permissao_trello === 'admin';

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <div style={{
                width: 120, height: 120, borderRadius: 6, overflow: 'hidden',
                border: `3px solid ${hover ? '#4318FF' : 'transparent'}`,
                transform: hover ? 'scale(1.05)' : 'scale(1)',
                transition: 'border-color .15s, transform .15s',
                background: '#E0E5F2', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {user.photo_url ? (
                    <img src={user.photo_url} alt={user.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{
                        fontSize: 42, fontWeight: 700, color: '#fff',
                        background: 'linear-gradient(135deg,#4318FF,#7551FF)',
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {initials}
                    </div>
                )}
            </div>
            <div style={{
                color: hover ? '#2B3674' : '#A3AED0',
                fontSize: 14, fontWeight: 500, textAlign: 'center', maxWidth: 120,
                transition: 'color .15s', textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
                {user.nome}
            </div>
            {isAdmin && (
                <div style={{ fontSize: 10, background: '#f5a623', color: '#000', padding: '2px 7px', borderRadius: 8, fontWeight: 800, letterSpacing: '.05em', marginTop: -4 }}>
                    ADMIN
                </div>
            )}
        </div>
    );
}
