import React, { useMemo } from 'react';
import type { Card } from './types';
import type { TrelloState } from './useTrello';

interface Props {
    state: TrelloState;
    onOpenCard: (card: Card) => void;
}

function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function prioritySort(a: Card, b: Card) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const score = (c: Card) => {
        if (c.done) return 100;
        if (!c.due_date) return 50;
        const d = new Date(c.due_date + 'T00:00:00');
        return Math.ceil((d.getTime() - today.getTime()) / 86400000);
    };
    return score(a) - score(b);
}

export default function ListView({ state, onOpenCard }: Props) {
    const { currentStages, myCards, showDone, toggleDone, removeCard, isAdmin } = state;

    const grouped = useMemo(() => {
        const map = new Map<string, Card[]>();
        for (const stage of currentStages) {
            let cards = myCards.filter(c => c.stage_id === stage.id);
            if (!showDone) cards = cards.filter(c => !c.done);
            cards.sort(prioritySort);
            map.set(stage.id, cards);
        }
        return map;
    }, [currentStages, myCards, showDone]);

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
                Visão em lista · {myCards.filter(c => !c.done).length} cartão{myCards.filter(c => !c.done).length !== 1 ? 's' : ''}
            </div>
            {currentStages.map(stage => {
                const cards = grouped.get(stage.id) || [];
                if (cards.length === 0) return null;
                return (
                    <div key={stage.id} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2B3674', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                height: 20, minWidth: 20, borderRadius: 10, padding: '0 6px',
                                background: '#E0E5F2', color: '#4318FF', fontSize: 11, fontWeight: 800,
                            }}>
                                {cards.length}
                            </span>
                            {stage.name}
                        </div>
                        <div style={{ background: '#fff', borderRadius: 6, boxShadow: '0 1px 3px rgba(9,30,66,0.1)' }}>
                            {cards.map(card => (
                                <div key={card.id} onClick={() => onOpenCard(card)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                        borderBottom: '1px solid #F4F7FE', cursor: 'pointer', transition: 'background .1s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#F4F7FE')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                >
                                    {/* Done toggle */}
                                    <button onClick={e => { e.stopPropagation(); toggleDone(card.id); }}
                                        style={{
                                            width: 20, height: 20, borderRadius: 4, border: `2px solid ${card.done ? '#61bd4f' : '#dfe1e6'}`,
                                            background: card.done ? '#61bd4f' : 'transparent', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                        {card.done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                                    </button>

                                    {/* Title */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 14, color: '#2B3674', lineHeight: '20px', fontWeight: 500,
                                            textDecoration: card.done ? 'line-through' : 'none', opacity: card.done ? 0.5 : 1,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {card.title || '(sem título)'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 12, color: '#A3AED0' }}>
                                            {card.clients?.name && <span>{card.clients.name}</span>}
                                            {card.usuarios?.nome && <span>· {card.usuarios.nome}</span>}
                                        </div>
                                    </div>

                                    {/* Due date */}
                                    <div style={{ fontSize: 12, fontWeight: 600, color: card.done ? '#A3AED0' : '#2B3674', whiteSpace: 'nowrap' }}>
                                        {fmtDate(card.due_date)}
                                    </div>

                                    {/* Labels */}
                                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                        {card.labels?.slice(0, 3).map(l => (
                                            <span key={l.id} style={{ height: 8, width: 32, borderRadius: 4, background: l.color }} />
                                        ))}
                                    </div>

                                    {/* User avatar */}
                                    {card.usuarios && (
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', background: '#4318FF', color: '#fff',
                                            fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, overflow: 'hidden',
                                        }}>
                                            {card.usuarios.photo_url ? <img src={card.usuarios.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : card.usuarios.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                    )}

                                    {/* Delete */}
                                    {isAdmin && (
                                        <button onClick={e => { e.stopPropagation(); if (confirm('Excluir?')) removeCard(card.id); }}
                                            style={{ border: 'none', background: 'transparent', color: '#dfe1e6', cursor: 'pointer', fontSize: 14, padding: 4, opacity: 0.5, flexShrink: 0 }}>
                                            🗑
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
