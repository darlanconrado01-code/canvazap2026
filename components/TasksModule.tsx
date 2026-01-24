
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc, onSnapshot, addDoc, serverTimestamp, deleteDoc, limit, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Plus, Search, Calendar as CalendarIcon, Clock, User, MoreVertical, Paperclip, RotateCcw, X, MessageSquare, Link as LinkIcon,
    AlertCircle, FileText, Trash2, Save, ExternalLink, Maximize2, CheckCircle2, Circle, ChevronRight, SearchCode,
    Settings, Layout, Folder, ChevronDown, Zap, Database, ArrowRight, Layers, CreditCard, Tag, CheckSquare, Users as MembersIcon,
    Building2, ShieldCheck, Image as ImageIcon, Loader2, List, Activity, Share2, ToggleLeft, Smile, Paperclip as ClipIcon, Send,
    ChevronLeft, Filter, GripVertical
} from 'lucide-react';
import { Task, TaskStatus, TaskCategory, TaskAttachment, TaskLink, TaskSeries, TaskPipelineColumn } from './TasksTypes';
import { uploadToR2, deleteFromR2 } from '../services/r2Service';

const DEFAULT_COLUMNS: TaskPipelineColumn[] = [
    { id: 'TODO', name: 'A Fazer', color: '#64748b' },
    { id: 'DOING', name: 'Em Andamento', color: '#3b82f6' },
    { id: 'REVIEW', name: 'Revisão', color: '#f59e0b' },
    { id: 'DONE', name: 'Concluído', color: '#10b981' }
];

const PRESET_LABELS = [
    { id: 'label_green', name: 'Critica', color: '#4bce97', textColor: '#164b35' },
    { id: 'label_yellow', name: 'Importante', color: '#f5cd47', textColor: '#533f04' },
    { id: 'label_orange', name: 'Média', color: '#fea362', textColor: '#702e00' },
    { id: 'label_red', name: 'Urgente', color: '#f87168', textColor: '#5d1f1a' },
    { id: 'label_purple', name: 'Ajuste', color: '#9f8fef', textColor: '#352c63' },
    { id: 'label_blue', name: 'Novo', color: '#579dff', textColor: '#002d69' }
];

const TasksModule = () => {
    const { userData } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<TaskCategory[]>([]);
    const [series, setSeries] = useState<TaskSeries[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'kanban' | 'calendar' | 'series' | 'categories'>('kanban');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('TODO');
    const [isUploadingGlobal, setIsUploadingGlobal] = useState<string | null>(null);

    useEffect(() => {
        if (!userData) return;
        if (userData.role !== 'super_admin' && !userData.companyId) {
            console.warn("TasksModule: Aguardando ID da empresa...");
            return;
        }

        // Query tasks: strictly your company (unless super_admin)
        const taskQuery = userData.role === 'super_admin'
            ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
            : query(collection(db, 'tasks'), where('companyId', '==', userData.companyId));

        // Categories & Series: strictly your company (unless super_admin)
        // Note: For now we maintain strict isolation as requested. 
        // If "global" defaults are needed, they should be marked for everyone.
        const catQuery = userData.role === 'super_admin'
            ? collection(db, 'task_categories')
            : query(collection(db, 'task_categories'), where('companyId', '==', userData.companyId));

        const seriesQuery = userData.role === 'super_admin'
            ? collection(db, 'task_series')
            : query(collection(db, 'task_series'), where('companyId', '==', userData.companyId));

        const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
            let taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            // Client-side sort to ensure descending order even without server index
            taskList = taskList.sort((a: any, b: any) => {
                // Handle serverTimestamp which might be null in local snapshot
                const tA = a.createdAt?.toMillis?.() || Date.now();
                const tB = b.createdAt?.toMillis?.() || Date.now();
                return tB - tA;
            });
            setTasks(taskList);
        }, (err) => console.error("FIRESTORE ERROR (tasks):", err));

        const fetchUsers = async () => {
            try {
                const uSnap = await getDocs(collection(db, 'users'));
                setUsers(uSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
            } catch (err) { console.error("Error users:", err); }
        };

        const fetchCompanies = async () => {
            try {
                const cSnap = await getDocs(collection(db, 'companies'));
                setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) { console.error("Error companies:", err); }
        };

        const unsubCats = onSnapshot(catQuery, (snap) => {
            setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskCategory)));
        }, (err) => console.error("FIRESTORE ERROR (cats):", err));

        const unsubSeries = onSnapshot(seriesQuery, (snap) => {
            setSeries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskSeries)));
        }, (err) => console.error("FIRESTORE ERROR (series):", err));

        fetchUsers();
        fetchCompanies();

        return () => {
            unsubTasks();
            unsubCats();
            unsubSeries();
        };
    }, [userData?.companyId, userData?.role]);

    const handleUploadFile = async (file: File, taskId: string, companyId?: string, isComment = false) => {
        if (!userData) return null;
        if (!isComment) setIsUploadingGlobal(taskId);
        try {
            const downloadURL = await uploadToR2(file, `tasks/${taskId}`);
            const r2Key = downloadURL.split('.com/')[1] || downloadURL.split('.dev/')[1];
            const attData = {
                taskId: taskId, companyId: companyId || userData?.companyId || null, uploaderUserId: userData.uid,
                name: file.name || `paste-${Date.now()}`, url: downloadURL, r2Key: r2Key,
                type: file.type.startsWith('image/') ? 'IMAGE' : 'FILE', createdAt: serverTimestamp()
            };
            const attRef = await addDoc(collection(db, 'task_attachments'), attData);

            if (!isComment) {
                const task = tasks.find(t => t.id === taskId);
                if (task) await updateDoc(doc(db, 'tasks', taskId), { attachmentsCount: (task.attachmentsCount || 0) + 1 });
            }
            return { id: attRef.id, ...attData, url: downloadURL };
        } catch (error: any) {
            console.error(error);
            alert(`Erro no upload: ${error.message}`);
            return null;
        } finally {
            if (!isComment) setIsUploadingGlobal(null);
        }
    };

    const handleCreateTask = async (taskData: any) => {
        if (!userData) return;
        const { isRecurrent, frequency, ...cleanData } = taskData;

        // Force the correct company ID based on user role
        const targetCompanyId = userData.role === 'super_admin'
            ? (cleanData.companyId || null)
            : userData.companyId;

        let seriesId = null;
        if (isRecurrent) {
            const seriesRef = await addDoc(collection(db, 'task_series'), {
                name: cleanData.name,
                frequency: frequency,
                isActive: true,
                defaultResponsibleUserId: cleanData.responsibleUserId,
                companyId: targetCompanyId,
                createdAt: serverTimestamp()
            });
            seriesId = seriesRef.id;
        }
        await addDoc(collection(db, 'tasks'), {
            ...cleanData,
            status: defaultStatus,
            seriesId: seriesId,
            companyId: targetCompanyId,
            createdBy: userData.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            attachmentsCount: 0,
            linksCount: 0,
            commentsCount: 0,
            labels: []
        });
        setIsCreateModalOpen(false);
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === '' || t.categoryId === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const activeCategory = categories.find(c => c.id === filterCategory);
    const activeColumns = activeCategory?.columns || DEFAULT_COLUMNS;

    return (
        <div className="fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 className="title" style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Layers className="text-secondary" /> Tarefas</h1>
            </div>

            <div className="glass-card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px' }}>
                {/* ESQUERDA: Categorias e Recorrência */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {[
                        { id: 'categories', name: 'Categorias', icon: Folder },
                        { id: 'series', name: 'Recorrência', icon: RotateCcw },
                    ].map(tab => (
                        <button key={tab.id} className={`btn-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id as any)} style={tabStyle(activeTab === tab.id)}><tab.icon size={14} style={{ marginRight: '6px' }} /> {tab.name}</button>
                    ))}
                </div>

                {/* CENTRO: Filtro por pesquisa e Categoria */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Filtrar demandas..." className="form-input" style={{ paddingLeft: '2.2rem', height: '34px', width: '220px', fontSize: '0.8rem', background: 'transparent' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Filter size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                        <select
                            className="form-input"
                            style={{ paddingLeft: '2.2rem', height: '34px', width: '180px', fontSize: '0.8rem', background: 'transparent', color: '#172b4d', appearance: 'none', fontWeight: 600 }}
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="" style={{ color: '#172b4d' }}>Categorias</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} style={{ color: '#172b4d' }}>{cat.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* DIREITA: Calendário e Kanban */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {[
                        { id: 'calendar', name: 'Calendário', icon: CalendarIcon },
                        { id: 'kanban', name: 'Kanban', icon: Layout },
                    ].map(tab => (
                        <button key={tab.id} className={`btn-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id as any)} style={tabStyle(activeTab === tab.id)}><tab.icon size={14} style={{ marginRight: '6px' }} /> {tab.name}</button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                {activeTab === 'kanban' && (
                    <div style={{ display: 'flex', gap: '1rem', height: '100%', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
                        {activeColumns.map(col => (
                            <TasksColumn
                                key={col.id} title={col.name} status={col.id} color={col.color}
                                tasks={filteredTasks.filter(t => t.status === col.id)}
                                onDrop={(e: any, s: any) => { if (e.dataTransfer.files?.length > 0) return; updateDoc(doc(db, 'tasks', e.dataTransfer.getData('taskId')), { status: s, updatedAt: serverTimestamp() }); }}
                                onTaskClick={(t: Task) => setSelectedTask(t)}
                                onCreateClick={() => { setDefaultStatus(col.id); setIsCreateModalOpen(true); }}
                                companies={companies} users={users} onUpload={handleUploadFile} isUploadingGlobal={isUploadingGlobal}
                                columns={activeColumns}
                            />
                        ))}
                    </div>
                )}
                {activeTab === 'calendar' && (
                    <TaskCalendar
                        tasks={filteredTasks}
                        onTaskClick={(t: Task) => setSelectedTask(t)}
                        users={users}
                        columns={activeColumns}
                    />
                )}
                {activeTab === 'series' && <SeriesManager series={series} users={users} />}
                {activeTab === 'categories' && <CategoriesManager categories={categories} />}
            </div>

            {isCreateModalOpen && <CreateTaskModal users={users} categories={categories} companies={companies} onClose={() => setIsCreateModalOpen(false)} onSave={handleCreateTask} />}
            {selectedTask && (
                <TrelloTaskModal
                    task={selectedTask} users={users} categories={categories} companies={companies} onClose={() => setSelectedTask(null)}
                    onUpdate={async (u: any) => { await updateDoc(doc(db, 'tasks', selectedTask.id), { ...u, updatedAt: serverTimestamp() }); setSelectedTask({ ...selectedTask, ...u }); }}
                    onDelete={async () => { if (confirm("Excluir tarefa?")) { await deleteDoc(doc(db, 'tasks', selectedTask.id)); setSelectedTask(null); } }}
                    onUpload={handleUploadFile} isUploadingGlobal={isUploadingGlobal}
                    columns={activeColumns}
                />
            )}
        </div>
    );
};

// CALENDAR COMPONENT
const TaskCalendar = ({ tasks, onTaskClick, users, columns }: any) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const days = [];
    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, month: 'prev', date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, month: 'current', date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, month: 'next', date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i) });
    }

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const setToday = () => setCurrentDate(new Date());
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return (
        <div className="glass-card fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#172b4d' }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                    <div style={{ display: 'flex', gap: '2px', background: '#ebecf0', padding: '2px', borderRadius: '4px' }}>
                        <button onClick={prevMonth} style={calNavBtn}><ChevronLeft size={16} /></button>
                        <button onClick={setToday} style={{ ...calNavBtn, fontSize: '0.75rem', padding: '0 8px' }}>Hoje</button>
                        <button onClick={nextMonth} style={calNavBtn}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'auto repeat(6, 1fr)', background: '#dfe1e6', gap: '1px' }}>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                    <div key={d} style={{ background: '#f4f5f7', padding: '8px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#626f86' }}>{d}</div>
                ))}
                {days.map((d, i) => {
                    const dayTasks = tasks.filter((t: any) => {
                        if (!t.dueDate) return false;
                        const tDate = t.dueDate.toDate();
                        return tDate.getDate() === d.date.getDate() && tDate.getMonth() === d.date.getMonth() && tDate.getFullYear() === d.date.getFullYear();
                    });
                    const isToday = new Date().toDateString() === d.date.toDateString();
                    return (
                        <div key={i} style={{ background: d.month === 'current' ? 'white' : '#f4f5f7', minHeight: '80px', padding: '4px', position: 'relative' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textAlign: 'right', padding: '2px 6px', color: d.month === 'current' ? (isToday ? 'white' : '#172b4d') : '#a5adba', background: isToday ? '#4318FF' : 'transparent', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>{d.day}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', overflowY: 'auto', maxHeight: 'calc(100% - 30px)' }}>
                                {dayTasks.map((t: any) => (
                                    <div key={t.id} onClick={() => onTaskClick(t)} style={{ background: 'white', border: '1px solid #dfe1e6', padding: '4px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 600, color: '#172b4d', cursor: 'pointer', boxShadow: '0 1px 1px rgba(0,0,0,0.1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: '4px', height: '12px', borderRadius: '2px', background: columns.find((c: any) => c.id === t.status)?.color || '#dfe1e6' }} />
                                        {t.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const calNavBtn: any = { background: 'white', border: 'none', padding: '4px', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#44546f' };

const TasksColumn = ({ title, status, tasks, color, onDrop, onTaskClick, onCreateClick, companies, users, onUpload, isUploadingGlobal, columns }: any) => {
    return (
        <div style={{ minWidth: '272px', width: '272px', background: '#f1f2f4', borderRadius: '12px', display: 'flex', flexDirection: 'column', maxHeight: '100%', border: 'none' }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, status)}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: '#172b4d' }}>{title}</h3>
                </div>
                <button style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: '4px', color: '#626f86' }}><MoreVertical size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} company={companies.find((c: any) => c.id === task.companyId)} responsible={users.find((u: any) => u.uid === task.responsibleUserId)} onUpload={onUpload} isUploading={isUploadingGlobal === task.id} columns={columns} />
                ))}
            </div>
            <div style={{ padding: '8px' }}>
                <button onClick={onCreateClick} style={trelloAddButtonStyle} onMouseEnter={(e: any) => e.target.style.background = 'rgba(9, 30, 66, 0.08)'} onMouseLeave={(e: any) => e.target.style.background = 'transparent'}><Plus size={16} /> Adicionar um cartão</button>
            </div>
        </div>
    );
};

const TaskCard = ({ task, onTaskClick, company, responsible, onUpload, isUploading, columns }: any) => {
    const [cover, setCover] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    useEffect(() => {
        const q = query(collection(db, 'task_attachments'), where('taskId', '==', task.id), where('type', '==', 'IMAGE'), limit(1));
        return onSnapshot(q, (s) => setCover(!s.empty ? s.docs[0].data().url : null));
    }, [task.id]);

    return (
        <div
            className="glass-card" style={{ padding: 0, cursor: 'pointer', fontSize: '0.85rem', borderRadius: '8px', overflow: 'hidden', background: 'white', border: isDragOver ? '2px dashed #4318FF' : 'none', position: 'relative', boxShadow: '0 1px 1px rgba(9,30,66,0.25)' }}
            draggable onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(e) => { e.preventDefault(); setIsDragOver(false); Array.from(e.dataTransfer.files).forEach(f => onUpload(f, task.id, task.companyId)); }}
            onClick={() => onTaskClick(task)}
        >
            {isUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" color="#4318FF" /></div>}
            {cover && <div style={{ width: '100%', height: '140px' }}><img src={cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
            <div style={{ padding: '8px 12px 12px 12px' }}>
                {task.labels?.length > 0 && <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>{task.labels.map((lId: string) => { const l = PRESET_LABELS.find(x => x.id === lId); return l ? <div key={lId} style={{ width: '40px', height: '8px', borderRadius: '4px', background: l.color }} title={l.name} /> : null; })}</div>}
                <div style={{ fontWeight: 500, marginBottom: '6px', lineHeight: 1.4, color: '#172b4d' }}>{task.name}</div>
                {company && <div style={{ fontSize: '0.65rem', color: '#4318FF', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>{company.name}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', color: '#626f86', fontSize: '0.65rem', fontWeight: 700 }}>
                        {task.dueDate && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={12} /> {task.dueDate?.toDate().toLocaleDateString('pt-BR')}</span>}
                        {(task.commentsCount || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MessageSquare size={12} /> {task.commentsCount}</span>}
                    </div>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#172b4d' }}>{responsible?.displayName?.charAt(0) || <User size={12} />}</div>
                </div>
            </div>
        </div>
    );
};

const TrelloTaskModal = ({ task, users, categories, companies, onClose, onUpdate, onDelete, onUpload, isUploadingGlobal, columns }: any) => {
    const { userData } = useAuth();
    const [atts, setAtts] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [activeMenu, setActiveMenu] = useState<'labels' | 'company' | 'members' | 'date' | 'category' | 'status' | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [tempDesc, setTempDesc] = useState(task.description || '');
    const [tempTitle, setTempTitle] = useState(task.name || '');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const commentFileRef = useRef<HTMLInputElement>(null);

    const activeColumn = columns.find((c: any) => c.id === task.status);
    const responsible = users.find((u: any) => u.uid === task.responsibleUserId);
    const company = companies.find((c: any) => c.id === task.companyId);
    const category = categories.find((c: any) => c.id === task.categoryId);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        if (!task.id) return;
        const unsubAtts = onSnapshot(query(collection(db, 'task_attachments'), where('taskId', '==', task.id)), (s) => setAtts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubComments = onSnapshot(query(collection(db, 'task_comments'), where('taskId', '==', task.id)), (s) => {
            const fetched = s.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setComments(fetched.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));
        });
        return () => { unsubAtts(); unsubComments(); };
    }, [task.id]);

    const handleAddComment = async () => {
        if ((!newComment.trim() && commentFiles.length === 0) || !userData) return;
        let uploadedAtts: any[] = [];
        for (const file of commentFiles) {
            const result = await onUpload(file, task.id, task.companyId, true);
            if (result) uploadedAtts.push(result);
        }
        await addDoc(collection(db, 'task_comments'), { taskId: task.id, userId: userData.uid, userName: userData.displayName || userData.email, text: newComment, attachmentIds: uploadedAtts.map(a => a.id), attachments: uploadedAtts, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'tasks', task.id), { commentsCount: (task.commentsCount || 0) + 1 });
        setNewComment(''); setCommentFiles([]);
    };

    const handleUpdateComment = async (commentId: string) => { if (!editCommentText.trim()) return; await updateDoc(doc(db, 'task_comments', commentId), { text: editCommentText, isEdited: true, updatedAt: serverTimestamp() }); setEditingCommentId(null); };
    const handleDeleteComment = async (commentId: string) => { if (!confirm("Excluir?")) return; await deleteDoc(doc(db, 'task_comments', commentId)); await updateDoc(doc(db, 'tasks', task.id), { commentsCount: Math.max(0, (task.commentsCount || 1) - 1) }); };
    const toggleLabel = async (labelId: string) => { const labels = task.labels || []; const newLabels = labels.includes(labelId) ? labels.filter((l: string) => l !== labelId) : [...labels, labelId]; await onUpdate({ labels: newLabels }); };

    return (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', padding: '5vh 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100 }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => onUpload(f, task.id, task.companyId)); }}>
            <div className="glass-card shadow-2xl" id="task-modal" style={{ width: '100%', maxWidth: '768px', padding: 0, borderRadius: '12px', overflowY: 'auto', background: '#f4f5f7', position: 'relative', maxHeight: '90vh' }}>
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], task.id, task.companyId)} style={{ display: 'none' }} />
                {atts.find(a => a.type === 'IMAGE') && <div style={{ width: '100%', height: '160px' }}><img src={atts.find(a => a.type === 'IMAGE').url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                <button style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.2)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', zIndex: 20 }} onClick={onClose}><X size={20} color="white" /></button>

                <div style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <Circle size={24} style={{ marginTop: '4px', color: '#172b4d' }} />
                        <div style={{ flex: 1 }}>
                            {isEditingTitle ? <textarea autoFocus value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onUpdate({ name: tempTitle }); setIsEditingTitle(false); }} style={trelloTitleInput} /> : <h2 onClick={() => setIsEditingTitle(true)} style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#172b4d', cursor: 'pointer' }}>{task.name || 'Sem título'}</h2>}
                            <div style={{ fontSize: '0.85rem', color: '#626f86', marginTop: '4px' }}>na lista <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setActiveMenu('status')}>{activeColumn?.name || 'A Fazer'}</span></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                <TrelloBlock label="Membros" node={<div onClick={() => setActiveMenu('members')} style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, cursor: 'pointer' }}>{responsible?.displayName?.charAt(0) || '?'}</div>} />
                                <TrelloBlock label="Etiquetas" node={<div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{(task.labels || []).map((lId: string) => { const l = PRESET_LABELS.find(x => x.id === lId); return l ? <div key={lId} style={{ background: l.color, color: l.textColor, padding: '4px 12px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700 }}>{l.name}</div> : null; })}<button onClick={() => setActiveMenu('labels')} style={{ width: '32px', height: '32px', borderRadius: '3px', background: '#091e420a', border: 'none', cursor: 'pointer' }}><Plus size={16} /></button></div>} />
                                <TrelloBlock label="Empresa" node={<div onClick={() => setActiveMenu('company')} style={{ background: '#4318FF', color: 'white', padding: '4px 12px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{company?.name || 'Geral'}</div>} />
                                <TrelloBlock label="Categoria" node={<div onClick={() => setActiveMenu('category')} style={{ background: '#dfe1e6', color: '#172b4d', padding: '4px 12px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{category?.name || 'Sem categoria'}</div>} />
                                <TrelloBlock label="Datas" node={<div onClick={() => setActiveMenu('date')} style={{ background: '#dfe1e6', color: '#172b4d', padding: '4px 12px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{task.dueDate ? task.dueDate.toDate().toLocaleDateString('pt-BR') : '-'}</div>} />
                            </div>

                            {activeMenu === 'status' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Mover Card</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{columns.map((c: any) => (
                                        <div key={c.id} onClick={() => { onUpdate({ status: c.id }); setActiveMenu(null); }} style={{ background: task.status === c.id ? '#4318FF' : '#f4f5f7', color: task.status === c.id ? 'white' : '#172b4d', padding: '8px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}>{c.name}</div>
                                    ))}</div>
                                </div>
                            )}

                            {activeMenu === 'labels' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Etiquetas</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{PRESET_LABELS.map(l => (
                                        <div key={l.id} onClick={() => toggleLabel(l.id)} style={{ background: l.color, color: l.textColor, padding: '8px 12px', borderRadius: '3px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>{l.name} {task.labels?.includes(l.id) && <CheckSquare size={14} />}</div>
                                    ))}</div>
                                </div>
                            )}

                            {activeMenu === 'members' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Membros</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {users.filter((u: any) => userData?.role === 'super_admin' || u.companyId === userData?.companyId).map((u: any) => (
                                            <div key={u.uid} onClick={() => { onUpdate({ responsibleUserId: u.uid }); setActiveMenu(null); }} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem', background: task.responsibleUserId === u.uid ? '#4318FF' : 'transparent', color: task.responsibleUserId === u.uid ? 'white' : '#172b4d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#172b4d' }}>{u.displayName?.charAt(0)}</div>
                                                {u.displayName}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeMenu === 'category' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Categoria</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {categories.map((c: any) => (
                                            <div key={c.id} onClick={() => { onUpdate({ categoryId: c.id }); setActiveMenu(null); }} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem', background: task.categoryId === c.id ? '#4318FF' : 'transparent', color: task.categoryId === c.id ? 'white' : '#172b4d' }}>{c.name}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeMenu === 'company' && userData?.role === 'super_admin' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Mudar Empresa</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {companies.map((c: any) => (
                                            <div key={c.id} onClick={() => { onUpdate({ companyId: c.id }); setActiveMenu(null); }} style={{ padding: '8px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem', background: task.companyId === c.id ? '#4318FF' : 'transparent', color: task.companyId === c.id ? 'white' : '#172b4d' }}>{c.name}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeMenu === 'date' && (
                                <div style={{ ...popupStyle, left: '60px', zIndex: 120 }}>
                                    <div style={popupHeaderStyle}>Data de Entrega</div>
                                    <input
                                        type="date"
                                        className="form-input"
                                        defaultValue={task.dueDate ? task.dueDate.toDate().toISOString().split('T')[0] : ''}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                await onUpdate({ dueDate: Timestamp.fromDate(new Date(val)) });
                                                setActiveMenu(null);
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
                                <List size={24} style={{ color: '#172b4d' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}><h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Descrição</h3>{!isEditingDesc && <button onClick={() => setIsEditingDesc(true)} style={trelloSecondaryBtn}>Editar</button>}</div>
                                    {isEditingDesc ? <div className="fade-in"><textarea autoFocus value={tempDesc} onChange={e => setTempDesc(e.target.value)} style={trelloDescInput} placeholder="Detalhes..." /><div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}><button className="btn btn-primary" style={{ padding: '6px 12px', width: 'auto' }} onClick={() => { onUpdate({ description: tempDesc }); setIsEditingDesc(false); }}>Salvar</button><button className="btn btn-secondary" style={{ padding: '6px 12px', width: 'auto' }} onClick={() => { setIsEditingDesc(false); setTempDesc(task.description || ''); }}>Cancelar</button></div></div> : <div onClick={() => setIsEditingDesc(true)} style={trelloDescPreview}>{task.description || 'Adicione uma descrição...'}</div>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Activity size={24} style={{ color: '#172b4d' }} />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700 }}>Atividade</h3>
                                    <div style={trelloCommentBox}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>{userData?.displayName?.charAt(0)}</div>
                                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', padding: '8px', border: '1px solid #dfe1e6' }}>
                                            <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comentar..." style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontSize: '0.9rem', minHeight: '40px' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                                <button onClick={() => commentFileRef.current?.click()} style={commentActionBtn}><ClipIcon size={16} /></button>
                                                <button onClick={handleAddComment} style={{ ...trelloPrimaryBtn, padding: '4px 12px' }}>Enviar</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>{comments.map(c => (
                                        <div key={c.id} style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>{c.userName?.charAt(0)}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.userName} <span style={{ fontWeight: 400, color: '#626f86', fontSize: '0.75rem' }}>{c.createdAt?.toDate().toLocaleString()}</span> {c.isEdited && <small>(Editado)</small>}</div>
                                                <div style={trelloCommentContent}>{c.text}</div>
                                                {c.userId === userData?.uid && <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}><button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: '#c9372c', fontSize: '0.7rem', cursor: 'pointer' }}>Excluir</button></div>}
                                            </div>
                                        </div>
                                    ))}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <TrelloSideGroup label="Adicionar" actions={[{ icon: Tag, label: 'Etiquetas', onClick: () => setActiveMenu('labels') }, { icon: Clock, label: 'Datas', onClick: () => setActiveMenu('date') }, { icon: ClipIcon, label: 'Anexo', onClick: () => fileInputRef.current?.click() }]} />
                            <TrelloSideGroup label="Ações" actions={[
                                {
                                    icon: Layers, label: 'Copiar', onClick: async () => {
                                        const { id, ...rest } = task;
                                        await addDoc(collection(db, 'tasks'), { ...rest, name: `${rest.name} (Cópia)`, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), commentsCount: 0, attachmentsCount: 0 });
                                        alert("Cópia criada!");
                                        onClose();
                                    }
                                },
                                { icon: Trash2, label: 'Excluir', color: '#c9372c', onClick: onDelete }
                            ]} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CategoriesManager = ({ categories }: any) => {
    const { userData } = useAuth();
    const [newName, setNewName] = useState('');
    const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
    const [cols, setCols] = useState<TaskPipelineColumn[]>([]);

    const isSuperAdmin = userData?.role === 'super_admin';

    const selectedCat = categories.find((c: any) => c.id === selectedCatId);

    useEffect(() => {
        if (selectedCat) setCols(selectedCat.columns || DEFAULT_COLUMNS);
        else setCols([]);
    }, [selectedCatId, categories]);

    const handleUpdateCols = async () => {
        if (!selectedCatId) return;
        await updateDoc(doc(db, 'task_categories', selectedCatId), { columns: cols });
        alert("Pipeline atualizado!");
    };

    const addCol = () => setCols([...cols, { id: `col_${Date.now()}`, name: 'Nova Etapa', color: '#64748b' }]);
    const removeCol = (id: string) => setCols(cols.filter(c => c.id !== id));
    const updateCol = (id: string, obj: any) => setCols(cols.map(c => c.id === id ? { ...c, ...obj } : c));

    return (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', height: '100%' }}>
            <div className="glass-card" style={{ padding: '1.5rem', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '1rem' }}>Categorias</h3>
                {categories.map((c: any) => (
                    <div key={c.id} onClick={() => setSelectedCatId(c.id)} style={{ padding: '10px', borderRadius: '8px', background: selectedCatId === c.id ? '#4318FF' : 'transparent', color: selectedCatId === c.id ? 'white' : '#172b4d', cursor: 'pointer', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {c.name}
                        {isSuperAdmin && <Trash2 size={14} onClick={(e) => { e.stopPropagation(); if (confirm("Remover?")) deleteDoc(doc(db, 'task_categories', c.id)); }} />}
                    </div>
                ))}
                {isSuperAdmin && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '5px' }}>
                        <input className="form-input" style={{ height: '34px' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova..." />
                        <button className="btn btn-primary" style={{ width: '40px', padding: 0 }} onClick={() => { if (newName) addDoc(collection(db, 'task_categories'), { name: newName, companyId: userData?.companyId || null, createdAt: serverTimestamp() }); setNewName(''); }}><Plus size={16} /></button>
                    </div>
                )}
            </div>

            <div className="glass-card" style={{ padding: '2rem', overflowY: 'auto' }}>
                {!selectedCatId ? (
                    <div style={{ textAlign: 'center', marginTop: '4rem', opacity: 0.5 }}>
                        {isSuperAdmin ? "Selecione uma categoria para editar seu Pipeline personalizado." : "Selecione uma categoria para ver o fluxo de trabalho."}
                    </div>
                ) : (
                    <div>
                        <h2 style={{ marginBottom: '1.5rem' }}>Pipeline: {selectedCat?.name}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem' }}>
                            {cols.map((col) => (
                                <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f4f5f7', padding: '10px', borderRadius: '8px' }}>
                                    <GripVertical size={16} color="#626f86" />
                                    <div style={{ width: '30px', height: '30px', borderRadius: '4px', background: col.color, border: '1px solid #dfe1e6' }} />
                                    {isSuperAdmin ? (
                                        <input className="form-input" style={{ flex: 1, height: '36px' }} value={col.name} onChange={e => updateCol(col.id, { name: e.target.value })} />
                                    ) : (
                                        <div style={{ flex: 1, fontWeight: 600 }}>{col.name}</div>
                                    )}
                                    {isSuperAdmin && (
                                        <>
                                            <input type="color" value={col.color} onChange={e => updateCol(col.id, { color: e.target.value })} style={{ width: '30px', height: '30px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                                            <button onClick={() => removeCol(col.id)} style={{ background: 'none', border: 'none', color: '#c1c7d0', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                        </>
                                    )}
                                </div>
                            ))}
                            {isSuperAdmin && <button className="btn btn-secondary" style={{ width: 'auto', alignSelf: 'flex-start' }} onClick={addCol}><Plus size={16} /> Adicionar Etapa</button>}
                        </div>
                        {isSuperAdmin && <button className="btn btn-primary" onClick={handleUpdateCols}>Salvar Pipeline Personalizado</button>}
                    </div>
                )}
            </div>
        </div>
    );
};

const SeriesManager = ({ series, users }: any) => {
    const { userData } = useAuth();
    const isSuperAdmin = userData?.role === 'super_admin';
    return (
        <div className="fade-in">
            <h3 style={{ marginBottom: '1.5rem' }}>Gestão de Recorrência</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {series.map((s: any) => (
                    <div key={s.id} className="glass-card" style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800 }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#4318FF' }}>{s.frequency}</div>
                        {isSuperAdmin && <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => deleteDoc(doc(db, 'task_series', s.id))}>Remover</button>}
                    </div>
                ))}
            </div>
        </div>
    );
};
const CreateTaskModal = ({ users, categories, companies, onClose, onSave }: any) => {
    const { userData } = useAuth();
    const [name, setName] = useState('');
    const [comp, setComp] = useState(userData?.role === 'super_admin' ? '' : userData?.companyId || '');
    const [cat, setCat] = useState('');
    const isSuperAdmin = userData?.role === 'super_admin';

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-card" style={{ width: '450px', padding: '2rem' }}>
                <h2>Nova Tarefa</h2>
                <div className="form-group">
                    <label className="form-label">Título</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Título da tarefa..." />
                </div>
                {isSuperAdmin && (
                    <div className="form-group">
                        <label className="form-label">Empresa</label>
                        <select className="form-input" value={comp} onChange={e => setComp(e.target.value)}>
                            <option value="">Geral</option>
                            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select className="form-input" value={cat} onChange={e => setCat(e.target.value)}>
                        <option value="">Nenhuma</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                        if (!name.trim()) return alert("Digite um título");
                        onSave({ name, companyId: comp, categoryId: cat });
                    }}>Criar</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const TrelloBlock = ({ label, node }: any) => <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#626f86', textTransform: 'uppercase' }}>{label}</div>{node}</div>;
const TrelloSideGroup = ({ label, actions }: any) => (<div><div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#626f86', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{actions.map((a: any, i: number) => <button key={i} onClick={a.onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#091e420a', border: 'none', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600, color: a.color || '#172b4d', borderRadius: '3px', cursor: 'pointer', textAlign: 'left' }}><a.icon size={14} /> {a.label}</button>)}</div></div>);
const popupStyle: any = { background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', width: '220px', position: 'absolute', zIndex: 100 };
const popupHeaderStyle: any = { fontSize: '0.75rem', fontWeight: 700, color: '#626f86', textAlign: 'center', marginBottom: '12px', borderBottom: '1px solid #dfe1e6', paddingBottom: '8px' };
const trelloAddButtonStyle: any = { width: '100%', padding: '6px 12px', borderRadius: '8px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px', color: '#44546f', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
const trelloTitleInput: any = { width: '100%', fontSize: '1.5rem', fontWeight: 700, border: '2px solid #4318FF', borderRadius: '4px', padding: '4px 8px', resize: 'none', background: 'white', color: '#172b4d' };
const trelloDescPreview: any = { background: 'rgba(9, 30, 66, 0.04)', padding: '12px', borderRadius: '4px', minHeight: '60px', cursor: 'pointer', fontSize: '0.9rem', color: '#172b4d' };
const trelloDescInput: any = { width: '100%', minHeight: '100px', padding: '12px', border: '1px solid #dfe1e6', background: 'white', borderRadius: '4px' };
const trelloCommentBox: any = { display: 'flex', gap: '1rem', marginBottom: '1rem' };
const commentActionBtn: any = { background: 'none', border: 'none', color: '#44546f', cursor: 'pointer' };
const trelloCommentContent: any = { background: 'white', padding: '10px', borderRadius: '4px', border: '1px solid #dfe1e6', marginTop: '4px' };
const trelloPrimaryBtn: any = { background: '#4318FF', color: 'white', border: 'none', borderRadius: '3px', fontWeight: 600, cursor: 'pointer' };
const trelloSecondaryBtn: any = { background: '#091e420a', border: 'none', padding: '6px 12px', borderRadius: '3px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };
const tabStyle = (active: boolean) => ({ display: 'flex', alignItems: 'center', padding: '0.45rem 0.85rem', border: 'none', background: active ? '#4318FF' : 'transparent', color: active ? 'white' : 'var(--text-muted)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' });

export default TasksModule;
