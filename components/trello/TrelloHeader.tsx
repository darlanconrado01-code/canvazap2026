import React, { useState, useRef, useEffect } from 'react';
import type { Card } from './types';
import type { TrelloState } from './useTrello';
import * as svc from './services';

interface Props {
    state: TrelloState;
    onOpenSearch: () => void;
}

export default function TrelloHeader({ state, onOpenSearch }: Props) {
    const {
        activeUser, logout, activePipelineId, switchPipeline,
        allPipelines, viewMode, setViewMode,
        showDone, setShowDone, viewAll, setViewAll,
        clientFilter, setClientFilter, allClients,
        isAdmin, refreshView,
    } = state;

    const [showPipelineMenu, setShowPipelineMenu] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const pipelineRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pipelineRef.current && !pipelineRef.current.contains(e.target as HTMLElement)) setShowPipelineMenu(false);
            if (viewRef.current && !viewRef.current.contains(e.target as HTMLElement)) setShowViewMenu(false);
            if (actionsRef.current && !actionsRef.current.contains(e.target as HTMLElement)) setShowActionsMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const currentPipeline = allPipelines.find(p => p.id === activePipelineId);

    const handleNewPipeline = async () => {
        const name = prompt('Nome do novo pipeline:');
        if (!name?.trim()) return;
        const pipe = await svc.createPipeline(name.trim());
        await state.init();
        switchPipeline(pipe.id);
    };

    const handleNewColumn = async () => {
        const name = prompt('Nome da nova coluna:');
        if (!name?.trim()) return;
        const stages = state.currentStages;
        await svc.createStage(activePipelineId!, name.trim(), stages.length);
        await refreshView();
    };

    const handleDeletePipeline = async () => {
        if (!activePipelineId) return;
        if (!confirm(`Excluir pipeline "${currentPipeline?.name}" e todas as suas colunas e cartões?`)) return;
        await svc.deletePipeline(activePipelineId);
        await state.init();
        const visible = state.getVisiblePipelines();
        if (visible.length) switchPipeline(visible[0].id);
    };

    return (
        <div style={{
            height: 56, background: 'rgba(244,245,250,0.94)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 1px 0 rgba(9,30,66,0.12)', display: 'flex',
            alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0,
            fontFamily: 'var(--font)', zIndex: 10,
        }}>
            {/* Logo */}
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4318FF', letterSpacing: -0.5, fontStyle: 'italic', textTransform: 'uppercase', marginRight: 4, cursor: 'default' }}>
                D3
            </div>

            {/* Pipeline dropdown */}
            <div ref={pipelineRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => { setShowPipelineMenu(!showPipelineMenu); setShowViewMenu(false); setShowActionsMenu(false); }}
                    style={{
                        height: 36, padding: '0 14px', borderRadius: 3, border: 'none',
                        background: '#fff', color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)',
                        fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 2px rgba(9,30,66,0.15)',
                    }}
                >
                    {currentPipeline?.name || 'Pipeline'} <span style={{ fontSize: 10, color: '#A3AED0' }}>▾</span>
                </button>
                {showPipelineMenu && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff',
                        borderRadius: 6, boxShadow: '0 8px 24px rgba(9,30,66,0.24)', minWidth: 200,
                        padding: '6px 0', zIndex: 100,
                    }}>
                        {state.getVisiblePipelines().map(p => (
                            <button key={p.id} onClick={() => { switchPipeline(p.id); setShowPipelineMenu(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px',
                                    border: 'none', background: p.id === activePipelineId ? '#E0E5F2' : 'transparent',
                                    color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500,
                                    cursor: 'pointer', textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: 12, width: 16, textAlign: 'center' }}>{p.id === activePipelineId ? '✓' : ''}</span>
                                {p.name}
                            </button>
                        ))}
                        {isAdmin && <>
                            <div style={{ height: 1, background: '#E0E5F2', margin: '4px 0' }} />
                            <button onClick={() => { handleNewPipeline(); setShowPipelineMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#4318FF', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer' }}>
                                + Novo Pipeline
                            </button>
                            {activePipelineId && <button onClick={() => { handleDeletePipeline(); setShowPipelineMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#eb5a46', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500, cursor: 'pointer' }}>
                                🗑 Excluir Pipeline
                            </button>}
                        </>}
                    </div>
                )}
            </div>

            {/* View mode dropdown */}
            <div ref={viewRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => { setShowViewMenu(!showViewMenu); setShowPipelineMenu(false); setShowActionsMenu(false); }}
                    style={{
                        height: 36, padding: '0 14px', borderRadius: 3, border: 'none',
                        background: '#fff', color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)',
                        fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 2px rgba(9,30,66,0.15)',
                    }}
                >
                    {viewMode === 'kanban' ? '☰ Kanban' : viewMode === 'list' ? '≡ Lista' : viewMode === 'month' ? '📅 Mês' : '📅 Semana'}
                    <span style={{ fontSize: 10, color: '#A3AED0' }}>▾</span>
                </button>
                {showViewMenu && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff',
                        borderRadius: 6, boxShadow: '0 8px 24px rgba(9,30,66,0.24)', minWidth: 180,
                        padding: '6px 0', zIndex: 100,
                    }}>
                        {[
                            { mode: 'kanban' as const, icon: '☰', label: 'Kanban' },
                            { mode: 'list' as const, icon: '≡', label: 'Lista' },
                            { mode: 'month' as const, icon: '📅', label: 'Calendário Mensal' },
                            { mode: 'week' as const, icon: '📅', label: 'Calendário Semanal' },
                        ].map(v => (
                            <button key={v.mode} onClick={() => { setViewMode(v.mode); setShowViewMenu(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px',
                                    border: 'none', background: v.mode === viewMode ? '#E0E5F2' : 'transparent',
                                    color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500,
                                    cursor: 'pointer', textAlign: 'left',
                                }}>
                                <span style={{ fontSize: 12, width: 20, textAlign: 'center' }}>{v.icon}</span>
                                {v.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Search button */}
            <button onClick={onOpenSearch} style={{
                height: 36, padding: '0 14px', borderRadius: 3, border: 'none',
                background: '#fff', color: '#A3AED0', fontSize: 14, fontFamily: 'var(--font)',
                fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 1px 2px rgba(9,30,66,0.15)',
            }}>
                🔍 Buscar <kbd style={{ fontSize: 10, color: '#A3AED0', background: '#F4F7FE', padding: '1px 4px', borderRadius: 3 }}>Ctrl+K</kbd>
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Actions dropdown */}
            <div ref={actionsRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => { setShowActionsMenu(!showActionsMenu); setShowPipelineMenu(false); setShowViewMenu(false); }}
                    style={{
                        height: 36, padding: '0 14px', borderRadius: 3, border: 'none',
                        background: '#4318FF', color: '#fff', fontSize: 14, fontFamily: 'var(--font)',
                        fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                >
                    ⚡ Ações <span style={{ fontSize: 10 }}>▾</span>
                </button>
                {showActionsMenu && (
                    <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff',
                        borderRadius: 6, boxShadow: '0 8px 24px rgba(9,30,66,0.24)', minWidth: 220,
                        padding: '6px 0', zIndex: 100,
                    }}>
                        <button onClick={() => { setShowDone(!showDone); setShowActionsMenu(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
                            <span>{showDone ? '✓' : '○'}</span> {showDone ? 'Ocultar Concluídos' : 'Mostrar Concluídos'}
                        </button>
                        <button onClick={() => { setViewAll(!viewAll); setShowActionsMenu(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
                            <span>{viewAll ? '👁' : '🔒'}</span> {viewAll ? 'Ver Todos' : 'Ver Meus Cartões'}
                        </button>
                        <div style={{ height: 1, background: '#E0E5F2', margin: '4px 0' }} />
                        <div style={{ padding: '6px 14px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Filtrar por cliente</div>
                            <select value={clientFilter || ''} onChange={e => { setClientFilter(e.target.value || null); setShowActionsMenu(false); }}
                                style={{ width: '100%', height: 32, borderRadius: 3, border: '2px solid #E0E5F2', padding: '0 8px', fontSize: 13, fontFamily: 'var(--font)', color: '#2B3674', outline: 'none', background: '#fff' }}>
                                <option value="">Todos os clientes</option>
                                {allClients.filter(c => c.ativo !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        {isAdmin && <>
                            <div style={{ height: 1, background: '#E0E5F2', margin: '4px 0' }} />
                            <button onClick={() => { handleNewColumn(); setShowActionsMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#4318FF', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}>
                                + Nova Coluna
                            </button>
                        </>}
                        {isAdmin && <div style={{ height: 1, background: '#E0E5F2', margin: '4px 0' }} />}
                        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: '#eb5a46', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                            🚪 Sair
                        </button>
                    </div>
                )}
            </div>

            {/* User avatar */}
            {activeUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#4318FF', color: '#fff',
                        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', boxShadow: '0 1px 3px rgba(67,24,255,0.3)',
                    }}>
                        {activeUser.photo_url ? <img src={activeUser.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : activeUser.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                </div>
            )}
        </div>
    );
}
