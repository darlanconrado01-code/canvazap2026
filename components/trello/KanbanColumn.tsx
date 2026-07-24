import React, { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import type { PipelineStage, Card } from './types';
import type { TrelloState } from './useTrello';

interface Props {
    stage: PipelineStage;
    cards: Card[];
    state: TrelloState;
    onOpenCard: (card: Card) => void;
}

export default function KanbanColumn({ stage, cards, state, onOpenCard }: Props) {
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { isAdmin, createQuickCard, showDone } = state;

    const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'stage', stage } });

    const visibleCards = showDone ? cards : cards.filter(c => !c.done);
    const doneCount = cards.filter(c => c.done).length;

    const handleAdd = async () => {
        if (!newTitle.trim()) return;
        await createQuickCard(stage.id, newTitle.trim());
        setNewTitle('');
        setAdding(false);
    };

    return (
        <div style={{
            background: '#F4F7FE', borderRadius: 3, width: 272, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            maxHeight: 'calc(100vh - 24px)',
            boxShadow: '0 1px 0 rgba(9,30,66,.25)',
            outline: isOver ? '2px dashed #4318FF' : 'none',
            outlineOffset: -2,
            transition: 'outline .15s',
        }}>
            <div style={{ padding: '10px 8px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2B3674', lineHeight: '20px', padding: '2px 4px' }}>
                        {stage.name}
                    </div>
                </div>
            </div>
            <div style={{ fontSize: 11, color: '#A3AED0', fontWeight: 600, padding: '0 12px 4px' }}>
                {visibleCards.length} cartão{visibleCards.length !== 1 ? 's' : ''}
                {doneCount > 0 && <span style={{ color: '#006644', fontWeight: 700 }}> · ✓ {doneCount} concluído{doneCount !== 1 ? 's' : ''}</span>}
            </div>
            <SortableContext items={visibleCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} style={{ flex: 1, overflowY: 'auto', padding: '0 8px', minHeight: 4 }}>
                    {visibleCards.map(card => (
                        <KanbanCard key={card.id} card={card} stageId={stage.id} state={state} onOpen={onOpenCard} />
                    ))}
                </div>
            </SortableContext>
            <div style={{ padding: '4px 8px 8px' }}>
                {adding ? (
                    <div style={{ background: '#fff', borderRadius: 3, boxShadow: '0 1px 4px rgba(9,30,66,0.25)', padding: '6px 8px', marginBottom: 8 }}>
                        <textarea
                            ref={inputRef}
                            autoFocus
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); }
                                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
                            }}
                            placeholder="Título do cartão"
                            style={{ width: '100%', border: 'none', resize: 'none', fontFamily: 'var(--font)', fontSize: 14, color: '#2B3674', background: 'transparent', outline: 'none', minHeight: 56, lineHeight: '20px' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <button onClick={handleAdd} style={{ height: 32, padding: '0 12px', borderRadius: 3, border: 'none', background: '#4318FF', color: '#fff', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer' }}>Adicionar</button>
                            <button onClick={() => { setAdding(false); setNewTitle(''); }} style={{ height: 32, width: 32, borderRadius: 3, border: 'none', background: 'transparent', color: '#A3AED0', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setAdding(true)}
                        style={{
                            width: '100%', height: 36, borderRadius: 3, border: 'none', background: 'transparent',
                            color: '#A3AED0', fontSize: 14, fontFamily: 'var(--font)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px',
                        }}
                    >
                        + Adicionar um cartão
                    </button>
                )}
            </div>
        </div>
    );
}
