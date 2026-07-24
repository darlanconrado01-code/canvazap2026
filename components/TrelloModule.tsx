import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { ShieldAlert } from 'lucide-react';
import { useTrello } from './trello/useTrello';
import type { Card } from './trello/types';
import ProfileSelector from './trello/ProfileSelector';
import TrelloHeader from './trello/TrelloHeader';
import KanbanBoard from './trello/KanbanBoard';
import ListView from './trello/ListView';
import CalendarView from './trello/CalendarView';
import CardModal from './trello/CardModal';
import SearchModal from './trello/SearchModal';
import { KanbanSkeleton, ListSkeleton, CalendarSkeleton } from './trello/Skeletons';
import { useKeyboardShortcuts } from './trello/useKeyboardShortcuts';

const TrelloModule = () => {
    const { userData } = useAuth();
    const isSuperAdmin = userData?.role === 'super_admin' || userData?.isSystemAdmin;

    if (!isSuperAdmin) {
        return (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <ShieldAlert size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                <h2 style={{ color: '#ef4444' }}>Acesso Restrito</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Este módulo é acessível apenas para administradores do sistema.
                </p>
            </div>
        );
    }

    return <TrelloApp />;
};

function TrelloApp() {
    const state = useTrello();
    const [modalCard, setModalCard] = useState<Card | null>(null);
    const [modalStageId, setModalStageId] = useState<string | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        state.init();
    }, []);

    const openCard = useCallback((card: Card) => {
        setModalCard(card);
        setModalStageId(card.stage_id);
    }, []);

    const openNewCard = useCallback((stageId: string) => {
        setModalCard(null);
        setModalStageId(stageId);
    }, []);

    const closeCardModal = useCallback(() => {
        setModalCard(null);
        setModalStageId(null);
    }, []);

    useKeyboardShortcuts({
        onSearch: () => setSearchOpen(true),
        onClose: () => { closeCardModal(); setSearchOpen(false); },
        onSwitchView: (mode) => state.setViewMode(mode),
    });

    if (state.loading && !state.activeUser) {
        return (
            <div style={{
                margin: '-1.5rem', width: 'calc(100% + 3rem)', flex: 1,
                display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
                <KanbanSkeleton />
            </div>
        );
    }

    if (!state.activeUser) {
        return (
            <div style={{
                margin: '-1.5rem', width: 'calc(100% + 3rem)', flex: 1,
                display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
                <ProfileSelector state={state} />
            </div>
        );
    }

    const viewLoading = state.loading && state.activeUser;

    return (
        <div style={{
            margin: '-1.5rem', width: 'calc(100% + 3rem)', flex: 1,
            display: 'flex', flexDirection: 'column', minHeight: 0,
            fontFamily: 'var(--font)',
        }}>
            <TrelloHeader state={state} onOpenSearch={() => setSearchOpen(true)} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
                {viewLoading ? (
                    state.viewMode === 'list' ? <ListSkeleton /> : state.viewMode === 'month' || state.viewMode === 'week' ? <CalendarSkeleton /> : <KanbanSkeleton />
                ) : (
                    <>
                        {state.viewMode === 'kanban' && <KanbanBoard state={state} onOpenCard={openCard} />}
                        {state.viewMode === 'list' && <ListView state={state} onOpenCard={openCard} />}
                        {(state.viewMode === 'month' || state.viewMode === 'week') && <CalendarView state={state} onOpenCard={openCard} mode={state.viewMode} />}
                    </>
                )}
            </div>

            {/* Card Modal */}
            <CardModal card={modalCard} stageId={modalStageId} state={state} onClose={closeCardModal} />

            {/* Search Modal */}
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} onOpenCard={openCard} />

            {/* Toast */}
            {state.toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#2B3674', color: '#fff', padding: '10px 20px', borderRadius: 6,
                    fontSize: 14, fontWeight: 600, zIndex: 500, boxShadow: '0 4px 12px rgba(9,30,66,0.3)',
                    animation: 'fadeIn .2s',
                }}>
                    {state.toast}
                </div>
            )}
        </div>
    );
}

export default TrelloModule;
