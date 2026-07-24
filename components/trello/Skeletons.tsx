import React from 'react';

const shimmer = `
@keyframes shimmer {
  0% { background-position: -468px 0; }
  100% { background-position: 468px 0; }
}
`;

function injectStyles() {
    if (document.getElementById('trello-skeleton-styles')) return;
    const style = document.createElement('style');
    style.id = 'trello-skeleton-styles';
    style.textContent = shimmer;
    document.head.appendChild(style);
}

function SkeletonBar({ width, height = 14, borderRadius = 3 }: { width: number | string; height?: number; borderRadius?: number }) {
    injectStyles();
    return (
        <div style={{
            width, height, borderRadius,
            background: 'linear-gradient(to right, #f0f0f0 8%, #e0e0e0 18%, #f0f0f0 33%)',
            backgroundSize: '800px 100%',
            animation: 'shimmer 1.5s infinite linear',
        }} />
    );
}

export function KanbanSkeleton() {
    return (
        <div style={{ display: 'flex', gap: 10, padding: '12px 8px', alignItems: 'flex-start', flex: 1 }}>
            {[1, 2, 3, 4].map(col => (
                <div key={col} style={{ width: 272, flexShrink: 0, background: '#F4F7FE', borderRadius: 3, padding: 10 }}>
                    <SkeletonBar width="60%" height={16} />
                    <div style={{ fontSize: 11, color: '#A3AED0', fontWeight: 600, padding: '4px 0' }}>
                        <SkeletonBar width="40%" height={10} />
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[1, 2, 3].map(card => (
                            <div key={card} style={{ background: '#fff', borderRadius: 3, padding: 10, boxShadow: '0 1px 2px rgba(9,30,66,0.1)' }}>
                                <SkeletonBar width="90%" height={14} />
                                <div style={{ marginTop: 6 }}>
                                    <SkeletonBar width="60%" height={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ListSkeleton() {
    return (
        <div style={{ padding: '16px 24px' }}>
            {[1, 2].map(group => (
                <div key={group} style={{ marginBottom: 20 }}>
                    <SkeletonBar width={120} height={14} />
                    <div style={{ background: '#fff', borderRadius: 6, marginTop: 8, overflow: 'hidden' }}>
                        {[1, 2, 3].map(row => (
                            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #F4F7FE' }}>
                                <SkeletonBar width={20} height={20} borderRadius={4} />
                                <div style={{ flex: 1 }}>
                                    <SkeletonBar width="70%" height={14} />
                                    <div style={{ marginTop: 4 }}><SkeletonBar width="40%" height={10} /></div>
                                </div>
                                <SkeletonBar width={80} height={12} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function CalendarSkeleton() {
    return (
        <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <SkeletonBar width={32} height={32} borderRadius={6} />
                <SkeletonBar width={200} height={32} borderRadius={6} />
                <SkeletonBar width={32} height={32} borderRadius={6} />
                <SkeletonBar width={80} height={32} borderRadius={6} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, background: '#E0E5F2', borderRadius: 6, overflow: 'hidden' }}>
                {Array.from({ length: 42 }).map((_, i) => (
                    <div key={i} style={{ background: '#fff', minHeight: 60, padding: 4 }}>
                        <SkeletonBar width="40%" height={10} />
                    </div>
                ))}
            </div>
        </div>
    );
}
