import React, { useCallback } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import type { Card } from './types';
import type { TrelloState } from './useTrello';
import * as svc from './services';

interface Props {
    state: TrelloState;
    onOpenCard: (card: Card) => void;
}

export default function KanbanBoard({ state, onOpenCard }: Props) {
    const { currentStages, myCards, moveCard, isAdmin } = state;
    const [activeCard, setActiveCard] = React.useState<Card | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragStart = useCallback((event: any) => {
        const { active } = event;
        const card = myCards.find(c => c.id === active.id);
        if (card) setActiveCard(card);
    }, [myCards]);

    const handleDragEnd = useCallback(async (event: any) => {
        const { active, over } = event;
        setActiveCard(null);
        if (!over) return;

        const activeData = active.data.current;
        if (activeData?.type !== 'card') return;

        const cardId = active.id;
        let targetStageId: string;

        if (over.data.current?.type === 'stage') {
            targetStageId = over.id;
        } else {
            const overCard = myCards.find(c => c.id === over.id);
            targetStageId = overCard?.stage_id || over.data.current?.stageId;
        }

        if (!targetStageId) return;

        const currentCard = myCards.find(c => c.id === cardId);
        if (currentCard && currentCard.stage_id !== targetStageId) {
            await moveCard(cardId, targetStageId);
        }
    }, [myCards, moveCard]);

    if (!currentStages.length) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A3AED0', fontSize: 14, fontWeight: 600 }}>
                Nenhuma etapa encontrada neste pipeline.
            </div>
        );
    }

    return (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 8px 8px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {currentStages.map(stage => {
                    const stageCards = myCards.filter(c => c.stage_id === stage.id);
                    return (
                        <KanbanColumn
                            key={stage.id}
                            stage={stage}
                            cards={stageCards}
                            state={state}
                            onOpenCard={onOpenCard}
                        />
                    );
                })}
                {isAdmin && (
                    <button
                        onClick={() => {
                            const name = prompt('Nome da nova coluna:');
                            if (name?.trim()) {
                                svc.createStage(state.activePipelineId!, name.trim(), currentStages.length).then(() => state.refreshView());
                            }
                        }}
                        style={{
                            width: 272, flexShrink: 0, height: 36, borderRadius: 3, border: 'none',
                            background: 'rgba(67,24,255,0.08)', color: '#4318FF', fontSize: 14, fontFamily: 'var(--font)',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            padding: '0 10px', whiteSpace: 'nowrap',
                        }}
                    >
                        + Outra lista
                    </button>
                )}
                <DragOverlay>
                    {activeCard ? (
                        <div style={{
                            background: '#fff', borderRadius: 3, boxShadow: '0 8px 16px rgba(9,30,66,.3)',
                            padding: '6px 8px', width: 260, opacity: 0.9,
                            fontSize: 14, color: '#2B3674',
                        }}>
                            {activeCard.title}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
