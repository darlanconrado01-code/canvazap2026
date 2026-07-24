import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
    onSearch?: () => void;
    onClose?: () => void;
    onToggleDone?: () => void;
    onSwitchView?: (mode: 'kanban' | 'list' | 'month' | 'week') => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT';
        const isCtrl = e.ctrlKey || e.metaKey;

        // Ctrl+K — search (works everywhere)
        if (isCtrl && e.key === 'k') {
            e.preventDefault();
            handlers.onSearch?.();
            return;
        }

        // Escape — close modals
        if (e.key === 'Escape') {
            handlers.onClose?.();
            return;
        }

        // Don't trigger shortcuts when typing in inputs
        if (isInput) return;

        // Number keys for view switching
        if (e.key === '1') handlers.onSwitchView?.('kanban');
        if (e.key === '2') handlers.onSwitchView?.('list');
        if (e.key === '3') handlers.onSwitchView?.('month');
        if (e.key === '4') handlers.onSwitchView?.('week');
    }, [handlers]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
