import { useState, useCallback, useRef, useEffect } from 'react';
import type {
    Pipeline, PipelineStage, Card, Client, TrelloUser,
    PipelinePermission, ViewMode, ClientContact, Label,
    Checklist, Attachment, CardComment, CardHistory
} from './types';
import * as svc from './services';

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

export function useTrello() {
    const [activeUser, setActiveUser] = useState<TrelloUser | null>(null);
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    const [currentStages, setCurrentStages] = useState<PipelineStage[]>([]);
    const [myCards, setMyCards] = useState<Card[]>([]);
    const [allPipelines, setAllPipelines] = useState<Pipeline[]>([]);
    const [allUsers, setAllUsers] = useState<TrelloUser[]>([]);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [allPermissions, setAllPermissions] = useState<PipelinePermission[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [showDone, setShowDone] = useState(false);
    const [viewAll, setViewAll] = useState(false);
    const [clientFilter, setClientFilter] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);
    const refreshLock = useRef(false);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }, []);

    const isAdmin = activeUser?.permissao_trello === 'admin';

    const getVisiblePipelines = useCallback(() => {
        if (isAdmin) return allPipelines;
        if (!activeUser) return [];
        const allowed = new Set(allPermissions.filter(p => p.user_id === activeUser.id).map(p => p.pipeline_id));
        if (allowed.size === 0) return allPipelines;
        return allPipelines.filter(p => allowed.has(p.id));
    }, [isAdmin, activeUser, allPipelines, allPermissions]);

    const init = useCallback(async () => {
        setLoading(true);
        try {
            const [pipes, cli, usr, perms] = await Promise.all([
                svc.fetchPipelines(),
                svc.fetchClients(),
                svc.fetchUsers(),
                svc.fetchPermissions(),
            ]);
            setAllPipelines(pipes);
            setAllClients(cli);
            setAllUsers(usr);
            setAllPermissions(perms);
        } finally {
            setLoading(false);
        }
    }, []);

    const enterAsUser = useCallback((user: TrelloUser) => {
        setActiveUser(user);
        setViewAll(false);
        setClientFilter(null);
        const visible = allPipelines; // simplified
        if (visible.length) switchPipeline(visible[0].id);
    }, [allPipelines]);

    const logout = useCallback(() => {
        setActiveUser(null);
        setMyCards([]);
        setCurrentStages([]);
    }, []);

    const switchPipeline = useCallback(async (id: string) => {
        setActivePipelineId(id);
        const stages = await svc.fetchStages(id);
        setCurrentStages(stages);
        if (!activeUser) return;
        const stageIds = stages.map(s => s.id);
        const cards = await svc.fetchCardsByStages(stageIds, viewAll ? undefined : activeUser.id, clientFilter || undefined);
        setMyCards(cards);
    }, [activeUser, viewAll, clientFilter]);

    const refreshView = useCallback(async () => {
        if (refreshLock.current) return;
        refreshLock.current = true;
        try {
            if (activePipelineId) await switchPipeline(activePipelineId);
        } finally {
            refreshLock.current = false;
        }
    }, [activePipelineId, switchPipeline]);

    const createQuickCard = useCallback(async (stageId: string, title: string) => {
        if (!activeUser || !title.trim()) return;
        await svc.insertCard({
            stage_id: stageId,
            title: title.trim(),
            assigned_to: activeUser.id,
            done: false,
        });
        await refreshView();
        showToast('Cartão criado');
    }, [activeUser, refreshView, showToast]);

    const toggleDone = useCallback(async (cardId: string) => {
        const card = myCards.find(c => c.id === cardId);
        if (!card) return;
        const newDone = !card.done;
        await svc.toggleCardDone(cardId, newDone);
        setMyCards(prev => prev.map(c => c.id === cardId ? { ...c, done: newDone } : c));
        showToast(newDone ? '✓ Concluído' : '↩ Reaberto');
    }, [myCards, showToast]);

    const moveCard = useCallback(async (cardId: string, newStageId: string) => {
        await svc.moveCard(cardId, newStageId);
        await refreshView();
    }, [refreshView]);

    const removeCard = useCallback(async (cardId: string) => {
        await svc.deleteCard(cardId);
        setMyCards(prev => prev.filter(c => c.id !== cardId));
        showToast('Cartão excluído');
    }, [showToast]);

    const cloneCardHandler = useCallback(async (card: Card) => {
        await svc.cloneCard(card);
        await refreshView();
        showToast('Cartão clonado');
    }, [refreshView, showToast]);

    return {
        activeUser, enterAsUser, logout, isAdmin,
        activePipelineId, switchPipeline,
        allPipelines, allUsers, allClients, allPermissions,
        currentStages, myCards,
        viewMode, setViewMode,
        showDone, setShowDone,
        viewAll, setViewAll,
        clientFilter, setClientFilter,
        loading, toast, showToast,
        init, refreshView,
        createQuickCard, toggleDone, moveCard, removeCard, cloneCard: cloneCardHandler,
        getVisiblePipelines,
    };
}

export type TrelloState = ReturnType<typeof useTrello>;
