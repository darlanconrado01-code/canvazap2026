import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Card } from './types';
import * as svc from './services';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onOpenCard: (card: Card) => void;
}

export default function SearchModal({ isOpen, onClose, onOpenCard }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Card[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const doSearch = useCallback((q: string) => {
        if (timer.current) clearTimeout(timer.current);
        if (!q.trim()) { setResults([]); return; }
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await svc.searchCards(q.trim(), 20);
                setResults(data);
                setSelectedIdx(0);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, []);

    useEffect(() => { doSearch(query); }, [query, doSearch]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter' && results[selectedIdx]) { onOpenCard(results[selectedIdx]); onClose(); }
        if (e.key === 'Escape') onClose();
    };

    if (!isOpen) return null;

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '120px',
            }}>
            <div style={{
                background: '#fff', borderRadius: 10, width: 520, maxWidth: 'calc(100vw - 40px)',
                boxShadow: '0 16px 48px rgba(9,30,66,0.3)', overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10, borderBottom: '2px solid #F4F7FE' }}>
                    <span style={{ fontSize: 18, color: '#A3AED0' }}>🔍</span>
                    <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Buscar cartões por título…" autoFocus
                        style={{ flex: 1, height: 36, border: 'none', outline: 'none', fontSize: 16, fontFamily: 'var(--font)', color: '#2B3674', background: 'transparent' }} />
                    <kbd style={{ fontSize: 11, color: '#A3AED0', background: '#F4F7FE', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>ESC</kbd>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ padding: '20px 16px', textAlign: 'center', color: '#A3AED0', fontSize: 14 }}>Buscando…</div>
                    )}
                    {!loading && query.trim() && results.length === 0 && (
                        <div style={{ padding: '20px 16px', textAlign: 'center', color: '#A3AED0', fontSize: 14 }}>Nenhum resultado para "{query}"</div>
                    )}
                    {results.map((card, i) => (
                        <div key={card.id}
                            onClick={() => { onOpenCard(card); onClose(); }}
                            onMouseEnter={() => setSelectedIdx(i)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                                background: i === selectedIdx ? '#EEF0FF' : 'transparent',
                                borderLeft: i === selectedIdx ? '3px solid #4318FF' : '3px solid transparent',
                                transition: 'background .08s',
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#2B3674', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 12, color: '#A3AED0' }}>
                                    {card.pipeline_stages?.name && <span>{card.pipeline_stages.name}</span>}
                                    {card.clients?.name && <span>· {card.clients.name}</span>}
                                    {card.due_date && <span>· {new Date(card.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                                </div>
                            </div>
                            {card.done && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#e3fcef', color: '#006644', fontWeight: 700 }}>✓</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
