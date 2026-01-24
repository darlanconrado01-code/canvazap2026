
import { Timestamp } from 'firebase/firestore';

export type TaskStatus = string; // Mudado de enum para string para suportar pipelines dinâmicos
export type AttachmentStatus = 'PENDING_UPLOAD' | 'UPLOADED' | 'FAILED' | 'DELETED';
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface TaskPipelineColumn {
    id: string;
    name: string;
    color: string;
}

export interface TaskCategory {
    id: string;
    name: string;
    parentId?: string;
    companyId?: string;
    createdAt: Timestamp;
    columns?: TaskPipelineColumn[]; // Pipelines personalizados da categoria
}

export interface TaskAttachment {
    id: string;
    taskId: string;
    companyId: string;
    uploaderUserId: string;
    type: 'IMAGE' | 'FILE';
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    status: AttachmentStatus;
    createdAt: Timestamp;
}

export interface Task {
    id: string;
    name: string;
    description?: string;
    status: TaskStatus;
    dueDate?: Timestamp;
    completedAt?: Timestamp;
    requesterId?: string;
    responsibleUserId: string;
    companyId: string;
    projectId?: string;
    categoryId: string;
    links?: string;
    seriesId?: string; // Para recorrência
    attachmentsCount?: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    deletedAt?: Timestamp;
}

export interface TaskSeries {
    id: string;
    companyId: string;
    name: string;
    defaultResponsibleUserId: string;
    defaultCategoryId: string;
    isActive: boolean;
    frequency: RecurrenceFrequency;
    interval: number;
    daysOfWeek?: number[]; // 0..6
    dayOfMonth?: number;
    nextDueDate: Timestamp;
    createdAt: Timestamp;
}

export interface TaskLink {
    id: string;
    taskId: string;
    url: string;
    title: string;
    createdAt: Timestamp;
}
