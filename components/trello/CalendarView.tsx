import React, { useMemo, useState } from 'react';
import type { Card } from './types';
import type { TrelloState } from './useTrello';

interface Props {
    state: TrelloState;
    onOpenCard: (card: Card) => void;
    mode: 'month' | 'week';
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarView({ state, onOpenCard, mode }: Props) {
    const { myCards, showDone } = state;
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const filteredCards = useMemo(() => {
        let cards = myCards.filter(c => c.due_date);
        if (!showDone) cards = cards.filter(c => !c.done);
        return cards;
    }, [myCards, showDone]);

    const days = useMemo(() => {
        if (mode === 'month') {
            return buildMonthDays(year, month);
        } else {
            return buildWeekDays(currentDate);
        }
    }, [year, month, currentDate, mode]);

    const cardsByDay = useMemo(() => {
        const map = new Map<string, Card[]>();
        for (const card of filteredCards) {
            if (!card.due_date) continue;
            const existing = map.get(card.due_date) || [];
            existing.push(card);
            map.set(card.due_date, existing);
        }
        return map;
    }, [filteredCards]);

    const goPrev = () => {
        const d = new Date(currentDate);
        if (mode === 'month') d.setMonth(d.getMonth() - 1);
        else d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const goNext = () => {
        const d = new Date(currentDate);
        if (mode === 'month') d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const goToday = () => {
        setCurrentDate(new Date());
        setSelectedDay(null);
    };

    const titleText = mode === 'month'
        ? `${MONTH_NAMES[month]} ${year}`
        : `Semana de ${days[0]?.label || ''}`;

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={goPrev} style={{ width: 32, height: 32, borderRadius: 6, border: '2px solid #E0E5F2', background: '#fff', color: '#2B3674', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2B3674', minWidth: 200, textAlign: 'center' }}>{titleText}</div>
                <button onClick={goNext} style={{ width: 32, height: 32, borderRadius: 6, border: '2px solid #E0E5F2', background: '#fff', color: '#2B3674', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                <button onClick={goToday} style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '2px solid #4318FF', background: '#fff', color: '#4318FF', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 600, cursor: 'pointer' }}>Hoje</button>
            </div>

            {/* Day detail panel */}
            {selectedDay && (
                <div style={{ background: '#fff', borderRadius: 6, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(9,30,66,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#2B3674' }}>
                            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                        <button onClick={() => setSelectedDay(null)} style={{ border: 'none', background: 'transparent', color: '#A3AED0', fontSize: 18, cursor: 'pointer' }}>✕</button>
                    </div>
                    {(cardsByDay.get(selectedDay) || []).length === 0 ? (
                        <div style={{ fontSize: 14, color: '#A3AED0' }}>Nenhum cartão para este dia.</div>
                    ) : (
                        (cardsByDay.get(selectedDay) || []).map(card => (
                            <div key={card.id} onClick={() => onOpenCard(card)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 4, cursor: 'pointer', marginBottom: 4 }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F4F7FE')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <div style={{ width: 4, height: 24, borderRadius: 2, background: card.done ? '#61bd4f' : (card.labels?.[0]?.color || '#E0E5F2') }} />
                                <div style={{ fontSize: 14, color: '#2B3674', flex: 1, textDecoration: card.done ? 'line-through' : 'none', opacity: card.done ? 0.5 : 1 }}>
                                    {card.title}
                                </div>
                                {card.usuarios && (
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#4318FF', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {card.usuarios.photo_url ? <img src={card.usuarios.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : card.usuarios.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Calendar grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
                background: '#E0E5F2',
                borderRadius: 6,
                overflow: 'hidden',
            }}>
                {/* Day headers */}
                {DAY_NAMES.map(d => (
                    <div key={d} style={{
                        background: '#fff', padding: '8px 4px', textAlign: 'center',
                        fontSize: 11, fontWeight: 700, color: '#A3AED0', textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>
                        {d}
                    </div>
                ))}
                {/* Day cells */}
                {days.map(day => {
                    const dayCards = cardsByDay.get(day.dateKey) || [];
                    const isToday = day.dateKey === formatDate(new Date());
                    const isSelected = day.dateKey === selectedDay;
                    const isCurrentMonth = day.inMonth;

                    return (
                        <div key={day.dateKey}
                            onClick={() => setSelectedDay(isSelected ? null : day.dateKey)}
                            style={{
                                background: isSelected ? '#EEF0FF' : isToday ? '#E8F4FD' : '#fff',
                                minHeight: 80, padding: 4, cursor: 'pointer',
                                transition: 'background .1s',
                                opacity: isCurrentMonth ? 1 : 0.4,
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F4F7FE'; }}
                            onMouseLeave={e => { if (!isSelected && !isToday) e.currentTarget.style.background = '#fff'; }}
                        >
                            <div style={{
                                fontSize: 12, fontWeight: 700, color: isToday ? '#4318FF' : '#2B3674',
                                marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {isToday ? (
                                    <span style={{
                                        width: 22, height: 22, borderRadius: '50%', background: '#4318FF',
                                        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11,
                                    }}>
                                        {day.dayNum}
                                    </span>
                                ) : day.dayNum}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {dayCards.slice(0, 3).map(c => (
                                    <div key={c.id} onClick={e => { e.stopPropagation(); onOpenCard(c); }}
                                        style={{
                                            fontSize: 11, color: '#fff', borderRadius: 2, padding: '1px 4px',
                                            background: c.done ? '#61bd4f' : (c.labels?.[0]?.color || '#4318FF'),
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            opacity: c.done ? 0.6 : 1, textDecoration: c.done ? 'line-through' : 'none',
                                        }}>
                                        {c.title}
                                    </div>
                                ))}
                                {dayCards.length > 3 && (
                                    <div style={{ fontSize: 10, color: '#A3AED0', fontWeight: 700, padding: '0 4px' }}>
                                        +{dayCards.length - 3} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface DayInfo {
    dateKey: string;
    dayNum: number;
    inMonth: boolean;
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function buildMonthDays(year: number, month: number): DayInfo[] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const result: DayInfo[] = [];
    const prevMonthLast = new Date(year, month, 0).getDate();

    for (let i = startOffset - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, prevMonthLast - i);
        result.push({ dateKey: formatDate(d), dayNum: prevMonthLast - i, inMonth: false });
    }
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const d = new Date(year, month, day);
        result.push({ dateKey: formatDate(d), dayNum: day, inMonth: true });
    }
    const remaining = 42 - result.length;
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        result.push({ dateKey: formatDate(d), dayNum: i, inMonth: false });
    }
    return result;
}

function buildWeekDays(current: Date): DayInfo[] {
    const d = new Date(current);
    d.setDate(d.getDate() - d.getDay());
    const result: DayInfo[] = [];
    for (let i = 0; i < 7; i++) {
        result.push({ dateKey: formatDate(d), dayNum: d.getDate(), inMonth: true });
        d.setDate(d.getDate() + 1);
    }
    return result;
}
