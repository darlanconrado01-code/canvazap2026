export interface Pipeline {
    id: string;
    name: string;
    created_at?: string;
}

export interface PipelineStage {
    id: string;
    pipeline_id: string;
    name: string;
    position: number;
    created_at?: string;
}

export interface Card {
    id: string;
    stage_id: string;
    title: string;
    description?: string;
    assigned_to?: string;
    client_id?: string;
    solicitante_id?: string;
    due_date?: string;
    start_date?: string;
    done: boolean;
    labels?: Label[];
    checklists?: Checklist[];
    attachments?: Attachment[];
    recurrence_days?: number;
    recurrence_mode?: string;
    created_at?: string;
    clients?: Client;
    usuarios?: TrelloUser;
    pipeline_stages?: PipelineStage;
}

export interface Label {
    id: string;
    name: string;
    color: string;
}

export interface Checklist {
    id: string;
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistItem {
    id: string;
    text: string;
    done: boolean;
}

export interface Attachment {
    id: string;
    name: string;
    url: string;
    created_at?: string;
}

export interface Client {
    id: string;
    name: string;
    logo_url?: string;
    ativo?: boolean;
}

export interface ClientContact {
    id: string;
    client_id: string;
    nome: string;
    cargo?: string;
    email?: string;
    whatsapp?: string;
}

export interface TrelloUser {
    id: string;
    nome: string;
    photo_url?: string;
    cargo?: string;
    permissao_trello?: 'admin' | 'usuario';
}

export interface PipelinePermission {
    id: string;
    user_id: string;
    pipeline_id: string;
}

export interface CardComment {
    id: string;
    card_id: string;
    user_id?: string;
    content?: string;
    text?: string;
    author_name?: string;
    created_at?: string;
    usuarios?: TrelloUser;
}

export interface CardHistory {
    id: string;
    card_id: string;
    user_id?: string;
    action: string;
    detail?: string;
    created_at?: string;
    usuarios?: TrelloUser;
}

export interface Lembrete {
    id: string;
    nome: string;
    mensagem?: string;
    data_disparo: string;
    hora_disparo?: string;
    wait_seconds?: number;
    destinatarios?: Recipient[];
    recurrence_days?: number;
    recurrence_mode?: string;
    recurrence_weekdays?: number[];
    status?: string;
    created_at?: string;
}

export interface Recipient {
    tipo: 'contato' | 'grupo' | 'numero';
    destino: string;
    label: string;
}

export interface WhatsAppGrupo {
    id: string;
    nome: string;
    jid: string;
}

export interface Alarme {
    id: string;
    titulo: string;
    mensagem?: string;
    data_disparo: string;
    hora_disparo?: string;
    escopo?: 'eu' | 'todos' | 'especificos';
    prioridade?: 'normal' | 'alta' | 'baixa';
    som?: boolean;
    criado_por?: string;
    status?: string;
    created_at?: string;
    alarme_destinatarios?: AlarmeDestinatario[];
}

export interface AlarmeDestinatario {
    id: string;
    alarme_id: string;
    user_id: string;
    status: 'pendente' | 'visto' | 'concluido' | 'adiado';
    snooze_count?: number;
    snooze_until?: string;
    visto_em?: string;
    concluido_em?: string;
    alarmes?: Alarme;
    usuarios?: TrelloUser;
}

export type ViewMode = 'kanban' | 'list' | 'month' | 'week' | 'chat';

export type RecurrenceMode = 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'custom';
