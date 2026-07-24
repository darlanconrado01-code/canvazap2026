import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from './types';
import type { TrelloState } from './useTrello';

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function fmtShort(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dateBadgeInfo(dueDate?: string, done?: boolean) {
    if (!dueDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate + 'T00:00:00');
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (done) return { cls: 'ok', icon: '📅', text: fmtShort(dueDate) };
    if (diff < 0) return { cls: 'overdue', icon: '⚠', text: fmtShort(dueDate) };
    if (diff <= 3) return { cls: 'soon', icon: '⏰', text: fmtShort(dueDate) };
    return { cls: 'ok', icon: '📅', text: fmtShort(dueDate) };
}

interface Props {
    card: Card;
    stageId: string;
    state: TrelloState;
    onOpen: (card: Card) => void;
}

export default function KanbanCard({ card, stageId, state, onOpen }: Props) {
    const isDone = !!card.done;
    const badge = dateBadgeInfo(card.due_date, isDone);
    const user = card.usuarios;
    const client = card.clients;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        data: { type: 'card', card, stageId },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => { e.stopPropagation(); onOpen(card); }}
            onContextMenu={(e) => { e.preventDefault(); }}
            className={`kanban-card ${isDone ? 'done-card' : ''}`}
        >
            {badge && !isDone && (
                <span style={{
                    fontWeight: 800, color: badge.cls === 'overdue' ? '#bf2600' : badge.cls === 'soon' ? '#974f0c' : '#A3AED0',
                    marginRight: 5, fontSize: 12,
                }}>
                    {badge.text}
                </span>
            )}
            {isDone && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 3, background: '#e3fcef', color: '#006644', display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 6 }}>✓ Concluído</span>}
            <span style={{ fontSize: 14, color: '#2B3674', lineHeight: '20px', wordBreak: 'break-word' }}>
                {card.title || '(sem título)'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {client && (
                    <span style={{ fontSize: 11, color: '#5ba4cf', fontWeight: 600 }}>
                        {client.logo_url && <img src={client.logo_url} alt="" style={{ width: 13, height: 13, borderRadius: '50%', objectFit: 'cover', marginRight: 4, verticalAlign: 'middle' }} />}
                        {client.name}
                    </span>
                )}
                {badge && isDone && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 3, background: '#e3fcef', color: '#006644' }}>✓ Feito</span>}
                {user && (
                    <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#4318FF', color: '#fff',
                        fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: 'auto', flexShrink: 0, overflow: 'hidden',
                    }}>
                        {user.photo_url ? <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                )}
            </div>
        </div>
    );
}
