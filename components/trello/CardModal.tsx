import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Card, Label, Checklist, ChecklistItem, ClientContact } from './types';
import type { TrelloState } from './useTrello';
import * as svc from './services';

const LABEL_COLORS = ['#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#0079bf', '#00c2e0', '#51e898', '#ff78cb', '#344563'];

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function asArray<T>(v: unknown): T[] {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
}

interface Props {
    card: Card | null;
    stageId: string | null;
    state: TrelloState;
    onClose: () => void;
}

export default function CardModal({ card, stageId, state, onClose }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [clientId, setClientId] = useState('');
    const [solicitanteId, setSolicitanteId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [done, setDone] = useState(false);
    const [labels, setLabels] = useState<Label[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [showMemberHint, setShowMemberHint] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
    const [newLabelName, setNewLabelName] = useState('');
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
    const isDirty = useRef(false);
    const isOpen = !!card;

    useEffect(() => {
        isDirty.current = false;
        if (card) {
            setTitle(card.title || '');
            setDescription(card.description || '');
            setAssignedTo(card.assigned_to || '');
            setClientId(card.client_id || '');
            setSolicitanteId(card.solicitante_id || '');
            setDueDate(card.due_date || '');
            setStartDate(card.start_date || '');
            setDone(!!card.done);
            setLabels(asArray<Label>(card.labels));
            setChecklists(asArray<Checklist>(card.checklists));
        } else {
            setTitle(''); setDescription(''); setAssignedTo(''); setClientId('');
            setSolicitanteId(''); setDueDate(''); setStartDate(''); setDone(false);
            setLabels([]); setChecklists([]);
        }
        setShowMemberHint(false);
        setShowLabelPicker(false);
    }, [card]);

    useEffect(() => {
        if (clientId) {
            svc.fetchContacts(clientId).then(setContacts);
        } else {
            setContacts([]);
        }
    }, [clientId]);

    useEffect(() => {
        if (card?.id) {
            svc.fetchComments(card.id).then(setComments);
        }
    }, [card?.id]);

    const markDirty = useCallback(() => { isDirty.current = true; }, []);

    const autoSave = useCallback(() => {
        if (!isDirty.current || !card?.id) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(async () => {
            if (!card?.id) return;
            try {
                await svc.updateCard(card.id, {
                    title, description, assigned_to: assignedTo || undefined,
                    client_id: clientId || undefined, solicitante_id: solicitanteId || undefined,
                    due_date: dueDate || undefined, start_date: startDate || undefined,
                    done,
                    labels: labels.length ? labels : undefined,
                    checklists: checklists.length ? checklists : undefined,
                } as any);
                isDirty.current = false;
            } catch (e) {
                console.error('[trello] auto-save failed:', e);
            }
        }, 800);
    }, [card, title, description, assignedTo, clientId, solicitanteId, dueDate, startDate, done, labels, checklists]);

    useEffect(() => {
        if (card?.id) autoSave();
    }, [title, description, assignedTo, clientId, solicitanteId, dueDate, startDate, done, labels, checklists, autoSave]);

    const handleSave = async () => {
        if (!assignedTo) { setShowMemberHint(true); return; }
        const payload: any = {
            title, description, assigned_to: assignedTo || undefined,
            client_id: clientId || undefined, solicitante_id: solicitanteId || undefined,
            due_date: dueDate || undefined, start_date: startDate || undefined,
            done,
            labels: labels.length ? labels : undefined,
            checklists: checklists.length ? checklists : undefined,
        };
        try {
            if (card?.id) {
                await svc.updateCard(card.id, payload);
            } else if (stageId) {
                await svc.insertCard({ ...payload, stage_id: stageId });
            }
            isDirty.current = false;
            state.refreshView();
            onClose();
        } catch (e) {
            console.error('[trello] save failed:', e);
            alert('Erro ao salvar. Tente novamente.');
        }
    };

    const handleDelete = async () => {
        if (!card?.id) return;
        if (!confirm('Excluir este cartão?')) return;
        await svc.deleteCard(card.id);
        state.refreshView();
        onClose();
    };

    const addChecklist = () => {
        const name = prompt('Nome da checklist:');
        if (!name?.trim()) return;
        markDirty();
        setChecklists(prev => [...prev, {
            id: Date.now().toString(), title: name.trim(), items: [],
        }]);
    };

    const addChecklistItem = (ci: number) => {
        const text = prompt('Novo item:');
        if (!text?.trim()) return;
        markDirty();
        setChecklists(prev => prev.map((cl, i) => i === ci ? {
            ...cl, items: [...cl.items, { id: Date.now().toString(), text: text.trim(), done: false }],
        } : cl));
    };

    const toggleCheckItem = (ci: number, ii: number) => {
        markDirty();
        setChecklists(prev => prev.map((cl, i) => i === ci ? {
            ...cl, items: cl.items.map((it, j) => j === ii ? { ...it, done: !it.done } : it),
        } : cl));
    };

    const deleteCheckItem = (ci: number, ii: number) => {
        markDirty();
        setChecklists(prev => prev.map((cl, i) => i === ci ? {
            ...cl, items: cl.items.filter((_, j) => j !== ii),
        } : cl));
    };

    const addLabel = () => {
        markDirty();
        setLabels(prev => [...prev, { id: Date.now().toString(), name: newLabelName || 'Etiqueta', color: newLabelColor }]);
        setNewLabelName('');
        setShowLabelPicker(false);
    };

    const removeLabel = (i: number) => {
        markDirty();
        setLabels(prev => prev.filter((_, idx) => idx !== i));
    };

    const submitComment = async () => {
        if (!commentText.trim() || !card?.id) return;
        await svc.insertComment({
            card_id: card.id,
            user_id: state.activeUser?.id,
            content: commentText.trim(),
            author_name: state.activeUser?.nome,
        });
        const updated = await svc.fetchComments(card.id);
        setComments(updated);
        setCommentText('');
    };

    if (!isOpen) return null;

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.64)', zIndex: 200,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                padding: '48px 0 80px', overflowY: 'auto',
            }}>
            <div style={{
                background: '#f4f5f7', borderRadius: 6, width: 800, maxWidth: 'calc(100vw - 24px)',
                position: 'relative', fontFamily: 'var(--font)', color: '#2B3674',
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%',
                    border: 'none', background: 'transparent', color: '#A3AED0', fontSize: 22, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}>✕</button>

                {/* Header */}
                <div style={{ padding: '16px 56px 8px 56px' }}>
                    <textarea
                        value={title}
                        onChange={e => { markDirty(); setTitle(e.target.value); }}
                        rows={1}
                        placeholder="Título do cartão"
                        style={{
                            fontSize: 20, fontWeight: 700, color: '#2B3674', border: 'none', background: 'transparent',
                            fontFamily: 'var(--font)', lineHeight: '28px', width: '100%', resize: 'none', outline: 'none',
                            borderRadius: 3, padding: '4px 8px', overflow: 'hidden',
                        }}
                    />
                </div>

                {/* Body */}
                <div style={{ display: 'flex', gap: 0, padding: '8px 0 16px' }}>
                    {/* Main */}
                    <div style={{ flex: 1, minWidth: 0, padding: '0 16px 0 56px' }}>
                        {/* Labels */}
                        {labels.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                {labels.map((l, i) => (
                                    <span key={l.id} onClick={() => removeLabel(i)} style={{
                                        height: 24, padding: '0 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                                        color: '#fff', background: l.color, cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    }}>
                                        {l.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Members + Dates */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Membros</div>
                                {assignedTo && (() => {
                                    const u = state.allUsers.find(x => x.id === assignedTo);
                                    return u ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', borderRadius: 3, background: '#fff', boxShadow: '0 1px 2px rgba(9,30,66,.1)' }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4318FF', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {u.photo_url ? <img src={u.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{u.nome}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em' }}>Data de início</label>
                                        <input type="date" value={startDate} onChange={e => { markDirty(); setStartDate(e.target.value); }} style={{ height: 32, borderRadius: 3, border: '2px solid transparent', background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 13, padding: '0 8px', outline: 'none' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em' }}>Data de entrega</label>
                                        <input type="date" value={dueDate} onChange={e => { markDirty(); setDueDate(e.target.value); }} style={{ height: 32, borderRadius: 3, border: '2px solid transparent', background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 13, padding: '0 8px', outline: 'none' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Client + Requester */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <select value={clientId} onChange={e => { markDirty(); setClientId(e.target.value); }} style={{ flex: 1, height: 34, borderRadius: 3, border: '2px solid transparent', background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 13, padding: '0 10px', outline: 'none' }}>
                                <option value="">— Empresa —</option>
                                {state.allClients.filter(c => c.ativo !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={solicitanteId} onChange={e => { markDirty(); setSolicitanteId(e.target.value); }} style={{ flex: 1, height: 34, borderRadius: 3, border: '2px solid transparent', background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 13, padding: '0 10px', outline: 'none' }}>
                                <option value="">— Solicitante —</option>
                                {contacts.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>

                        {/* Member (required) */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                            <select value={assignedTo}                                 onChange={e => { markDirty(); setAssignedTo(e.target.value); setShowMemberHint(false); }}
                                style={{ flex: 1, height: 34, borderRadius: 3, border: '2px solid transparent', background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 13, padding: '0 10px', outline: 'none' }}>
                                <option value="">⚠ Responsável obrigatório…</option>
                                {state.allUsers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                            </select>
                        </div>
                        {showMemberHint && <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: -4, marginBottom: 8 }}>⚠ Todo cartão precisa ter um responsável.</div>}

                        {/* Description */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 16 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em' }}>Descrição</span>
                        </div>
                        <textarea
                            value={description}
                            onChange={e => { markDirty(); setDescription(e.target.value); }}
                            placeholder="Adicione uma descrição mais detalhada…"
                            style={{
                                width: '100%', minHeight: 80, borderRadius: 3, border: 'none',
                                background: 'rgba(9,30,66,0.06)', color: '#2B3674', fontSize: 14, fontFamily: 'var(--font)',
                                padding: '10px 12px', resize: 'vertical', outline: 'none', lineHeight: '20px',
                            }}
                        />

                        {/* Checklists */}
                        {checklists.map((cl, ci) => {
                            const total = cl.items.length;
                            const done = cl.items.filter(i => i.done).length;
                            const pct = total > 0 ? (done / total) * 100 : 0;
                            return (
                                <div key={cl.id} style={{ marginBottom: 8, marginTop: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700 }}>{cl.title}</span>
                                        <button onClick={() => setChecklists(prev => prev.filter((_, i) => i !== ci))} style={{ border: 'none', background: 'transparent', color: '#A3AED0', cursor: 'pointer', fontSize: 16 }}>🗑</button>
                                    </div>
                                    <div style={{ height: 6, background: '#dfe1e6', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: pct === 100 ? '#61bd4f' : '#0079bf', borderRadius: 3, width: `${pct}%`, transition: 'width .25s' }} />
                                    </div>
                                    {cl.items.map((item, ii) => (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', cursor: 'pointer', borderRadius: 3 }} onClick={() => toggleCheckItem(ci, ii)}>
                                            <input type="checkbox" checked={item.done} readOnly style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, cursor: 'pointer', accentColor: '#4318FF' }} />
                                            <span style={{ fontSize: 14, color: '#2B3674', lineHeight: '20px', flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.5 : 1 }}>{item.text}</span>
                                            <button onClick={e => { e.stopPropagation(); deleteCheckItem(ci, ii); }} style={{ border: 'none', background: 'transparent', color: '#A3AED0', fontSize: 14, cursor: 'pointer', display: 'none' }}>✕</button>
                                        </div>
                                    ))}
                                    <button onClick={() => addChecklistItem(ci)} style={{ width: '100%', height: 34, borderRadius: 3, border: '2px solid #4318FF', background: '#fff', color: '#2B3674', fontSize: 13, fontFamily: 'var(--font)', padding: '0 10px', outline: 'none', marginTop: 6, cursor: 'pointer' }}>
                                        + Adicionar item
                                    </button>
                                </div>
                            );
                        })}

                        {/* Comments */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Comentários</div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5ba4cf', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {state.activeUser?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <textarea
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        placeholder="Escrever um comentário…"
                                        style={{
                                            width: '100%', minHeight: 40, borderRadius: 3, border: '2px solid #E0E5F2',
                                            padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font)', color: '#2B3674',
                                            resize: 'none', outline: 'none', background: '#fff', lineHeight: '20px',
                                        }}
                                    />
                                    {commentText.trim() && (
                                        <button onClick={submitComment} style={{
                                            marginTop: 6, height: 28, padding: '0 12px', borderRadius: 3, border: 'none',
                                            background: '#4318FF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                        }}>Salvar</button>
                                    )}
                                </div>
                            </div>
                            {comments.map((c: any) => (
                                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5ba4cf', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {c.usuarios?.photo_url ? <img src={c.usuarios.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.author_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700 }}>{c.author_name || c.usuarios?.nome}</span>
                                            <span style={{ fontSize: 11, color: '#A3AED0' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : ''}</span>
                                        </div>
                                        <div style={{ fontSize: 14, color: '#2B3674', lineHeight: '20px', background: '#fff', borderRadius: 3, padding: '8px 12px', boxShadow: '0 1px 2px rgba(9,30,66,.1)', wordBreak: 'break-word' }}>
                                            {c.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ width: 200, flexShrink: 0, padding: '0 16px 0 8px' }}>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Adicionar ao cartão</div>
                            <button onClick={() => setShowLabelPicker(!showLabelPicker)} style={{ width: '100%', height: 32, borderRadius: 3, border: 'none', background: 'rgba(9,30,66,0.08)', color: '#2B3674', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginBottom: 6 }}>🏷 Etiquetas</button>
                            <button onClick={addChecklist} style={{ width: '100%', height: 32, borderRadius: 3, border: 'none', background: 'rgba(9,30,66,0.08)', color: '#2B3674', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginBottom: 6 }}>☑ Checklist</button>
                        </div>

                        {showLabelPicker && (
                            <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 8px 20px rgba(9,30,66,.25)', width: 240, padding: 12, marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Etiquetas</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                    {LABEL_COLORS.map(c => (
                                        <div key={c} onClick={() => setNewLabelColor(c)} style={{
                                            width: 36, height: 24, borderRadius: 4, cursor: 'pointer',
                                            border: `3px solid ${c === newLabelColor ? '#172b4d' : 'transparent'}`,
                                            background: c, transition: 'border-color .1s',
                                        }} />
                                    ))}
                                </div>
                                <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="Nome da etiqueta (opcional)" style={{ width: '100%', height: 32, borderRadius: 3, border: '2px solid #E0E5F2', padding: '0 8px', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', marginBottom: 8 }} />
                                <button onClick={addLabel} style={{ height: 30, padding: '0 12px', borderRadius: 3, border: 'none', background: '#4318FF', color: '#fff', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer' }}>Adicionar</button>
                            </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Ações</div>
                            <button onClick={() => { setDone(!done); }} style={{
                                width: '100%', height: 32, borderRadius: 3, border: 'none',
                                background: done ? '#61bd4f' : 'rgba(9,30,66,0.08)',
                                color: done ? '#fff' : '#2B3674',
                                fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', marginBottom: 6,
                            }}>
                                {done ? '✓ Concluído' : '✓ Marcar como Concluído'}
                            </button>
                            <button onClick={handleSave} style={{
                                width: '100%', height: 40, borderRadius: 6, border: 'none',
                                background: 'linear-gradient(135deg,#0065ff,#0052cc)', color: '#fff',
                                fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,82,204,0.45)',
                                letterSpacing: '.03em', marginBottom: 6,
                            }}>
                                💾 Salvar alterações
                            </button>
                            {card?.id && (
                                <button onClick={handleDelete} style={{
                                    width: '100%', height: 32, borderRadius: 3, border: 'none',
                                    background: '#eb5a46', color: '#fff',
                                    fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
                                }}>🗑 Excluir</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
