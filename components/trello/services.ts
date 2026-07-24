import { createProxiedClient } from '@/services/supabaseConfig';
import type {
    Pipeline, PipelineStage, Card, Client, ClientContact, TrelloUser,
    PipelinePermission, CardComment, CardHistory, Lembrete, WhatsAppGrupo,
    Alarme, AlarmeDestinatario
} from './types';

const sb = createProxiedClient();

function requireSb() {
    if (!sb) throw new Error('Supabase client not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return sb;
}

// ═══ PIPELINES ═══
export async function fetchPipelines(): Promise<Pipeline[]> {
    const { data, error } = await requireSb().from('pipelines').select('*').order('name');
    if (error) throw error;
    return data || [];
}

export async function createPipeline(name: string): Promise<Pipeline> {
    const { data, error } = await requireSb().from('pipelines').insert({ name }).select().single();
    if (error) throw error;
    return data;
}

export async function deletePipeline(id: string): Promise<void> {
    const sClient = requireSb();
    const { data: stages } = await sClient.from('pipeline_stages').select('id').eq('pipeline_id', id);
    if (stages?.length) {
        const stageIds = stages.map(s => s.id);
        await sClient.from('cards').delete().in('stage_id', stageIds);
    }
    await sClient.from('pipeline_stages').delete().eq('pipeline_id', id);
    await sClient.from('pipelines').delete().eq('id', id);
}

// ═══ STAGES ═══
export async function fetchStages(pipelineId: string): Promise<PipelineStage[]> {
    const { data, error } = await requireSb().from('pipeline_stages').select('*').eq('pipeline_id', pipelineId).order('position');
    if (error) throw error;
    return data || [];
}

export async function fetchAllStages(): Promise<PipelineStage[]> {
    const { data, error } = await requireSb().from('pipeline_stages').select('*').order('position');
    if (error) throw error;
    return data || [];
}

export async function createStage(pipelineId: string, name: string, position: number): Promise<PipelineStage> {
    const { data, error } = await requireSb().from('pipeline_stages').insert({ pipeline_id: pipelineId, name, position }).select().single();
    if (error) throw error;
    return data;
}

export async function updateStageName(id: string, name: string): Promise<void> {
    await requireSb().from('pipeline_stages').update({ name }).eq('id', id);
}

export async function updateStagePositions(updates: { id: string; position: number }[]): Promise<void> {
    const sClient = requireSb();
    for (const u of updates) {
        await sClient.from('pipeline_stages').update({ position: u.position }).eq('id', u.id);
    }
}

export async function deleteStage(id: string): Promise<void> {
    const sClient = requireSb();
    await sClient.from('cards').delete().eq('stage_id', id);
    await sClient.from('pipeline_stages').delete().eq('id', id);
}

// ═══ CARDS ═══
export async function fetchCardsByStages(
    stageIds: string[],
    assignedTo?: string,
    clientId?: string
): Promise<Card[]> {
    let q = requireSb().from('cards')
        .select('*,clients(name),usuarios(nome,photo_url)')
        .in('stage_id', stageIds)
        .order('due_date', { ascending: true, nullsFirst: false });
    if (assignedTo) q = q.eq('assigned_to', assignedTo);
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) { console.error('[trello] fetchCardsByStages error:', error); return []; }
    return data || [];
}

export async function fetchAllCards(clientId?: string): Promise<Card[]> {
    let q = requireSb().from('cards')
        .select('*,clients(name),usuarios(nome,photo_url)')
        .order('due_date', { ascending: true, nullsFirst: false });
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) { console.error('[trello] fetchAllCards error:', error); return []; }
    return data || [];
}

export async function fetchCard(cardId: string): Promise<Card | null> {
    const { data, error } = await requireSb().from('cards')
        .select('*,clients(name,logo_url),usuarios(nome,photo_url)')
        .eq('id', cardId).single();
    if (error) return null;
    return data;
}

export async function insertCard(card: Partial<Card>): Promise<Card> {
    const { data, error } = await requireSb().from('cards').insert(card).select().single();
    if (error) throw error;
    return data;
}

export async function updateCard(id: string, updates: Partial<Card>): Promise<void> {
    const { error } = await requireSb().from('cards').update(updates).eq('id', id);
    if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
    const sClient = requireSb();
    await sClient.from('card_comments').delete().eq('card_id', id);
    await sClient.from('cards').delete().eq('id', id);
}

export async function moveCard(cardId: string, newStageId: string): Promise<void> {
    await updateCard(cardId, { stage_id: newStageId } as any);
}

export async function toggleCardDone(id: string, done: boolean): Promise<void> {
    await updateCard(id, { done } as any);
}

export async function cloneCard(original: Card): Promise<Card> {
    const clone = {
        ...original,
        title: `[Copia] ${original.title}`,
        done: false,
    };
    delete (clone as any).id;
    delete (clone as any).created_at;
    delete (clone as any).clients;
    delete (clone as any).usuarios;
    delete (clone as any).pipeline_stages;
    return insertCard(clone);
}

// ═══ CLIENTS ═══
export async function fetchClients(): Promise<Client[]> {
    const { data, error } = await requireSb().from('clients').select('*').order('name');
    if (error) throw error;
    return data || [];
}

export async function createClient(name: string, logoUrl?: string): Promise<Client> {
    const { data, error } = await requireSb().from('clients').insert({ name, logo_url: logoUrl || null }).select().single();
    if (error) throw error;
    return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
    await requireSb().from('clients').update(updates).eq('id', id);
}

export async function deleteClientRecord(id: string): Promise<void> {
    await requireSb().from('clients').delete().eq('id', id);
}

// ═══ CONTACTS ═══
export async function fetchContacts(clientId: string): Promise<ClientContact[]> {
    const { data } = await requireSb().from('client_contacts').select('*').eq('client_id', clientId).order('nome');
    return data || [];
}

export async function createContact(contact: Partial<ClientContact>): Promise<ClientContact> {
    const { data, error } = await requireSb().from('client_contacts').insert(contact).select().single();
    if (error) throw error;
    return data;
}

export async function updateContact(id: string, updates: Partial<ClientContact>): Promise<void> {
    await requireSb().from('client_contacts').update(updates).eq('id', id);
}

export async function deleteContact(id: string): Promise<void> {
    await requireSb().from('client_contacts').delete().eq('id', id);
}

// ═══ USERS ═══
export async function fetchUsers(): Promise<TrelloUser[]> {
    const { data, error } = await requireSb().from('usuarios').select('*').order('nome');
    if (error) throw error;
    return data || [];
}

export async function createUser(user: Partial<TrelloUser>): Promise<TrelloUser> {
    const { data, error } = await requireSb().from('usuarios').insert(user).select().single();
    if (error) throw error;
    return data;
}

export async function updateUser(id: string, updates: Partial<TrelloUser>): Promise<void> {
    await requireSb().from('usuarios').update(updates).eq('id', id);
}

export async function deleteUser(id: string): Promise<void> {
    await requireSb().from('usuarios').delete().eq('id', id);
}

// ═══ PERMISSIONS ═══
export async function fetchPermissions(): Promise<PipelinePermission[]> {
    const { data } = await requireSb().from('user_pipeline_permissions').select('*');
    return data || [];
}

export async function togglePermission(userId: string, pipelineId: string, hasPermission: boolean): Promise<void> {
    const sClient = requireSb();
    if (hasPermission) {
        await sClient.from('user_pipeline_permissions').delete().eq('user_id', userId).eq('pipeline_id', pipelineId);
    } else {
        await sClient.from('user_pipeline_permissions').insert({ user_id: userId, pipeline_id: pipelineId });
    }
}

// ═══ COMMENTS ═══
export async function fetchComments(cardId: string): Promise<CardComment[]> {
    const { data } = await requireSb().from('card_comments')
        .select('*,usuarios(nome,photo_url)')
        .eq('card_id', cardId).order('created_at', { ascending: true });
    if (!data) return [];
    return data.map(c => ({ ...c, content: c.content || c.text }));
}

export async function insertComment(comment: Partial<CardComment>): Promise<CardComment> {
    const { data, error } = await requireSb().from('card_comments').insert(comment).select().single();
    if (error) throw error;
    return data;
}

export async function updateComment(id: string, content: string): Promise<void> {
    await requireSb().from('card_comments').update({ content }).eq('id', id);
}

export async function deleteCommentRecord(id: string): Promise<void> {
    await requireSb().from('card_comments').delete().eq('id', id);
}

// ═══ HISTORY ═══
export async function fetchHistory(cardId: string): Promise<CardHistory[]> {
    const { data } = await requireSb().from('card_history')
        .select('*,usuarios(nome,photo_url)')
        .eq('card_id', cardId).order('created_at', { ascending: false });
    return data || [];
}

export async function addHistoryEntry(cardId: string, userId: string, action: string, detail?: string): Promise<void> {
    await requireSb().from('card_history').insert({ card_id: cardId, user_id: userId, action, detail });
}

// ═══ REMINDERS ═══
export async function fetchLembretes(): Promise<Lembrete[]> {
    const { data } = await requireSb().from('lembretes').select('*').order('data_disparo', { ascending: false });
    return data || [];
}

export async function insertLembrete(lembrete: Partial<Lembrete>): Promise<Lembrete> {
    const { data, error } = await requireSb().from('lembretes').insert(lembrete).select().single();
    if (error) throw error;
    return data;
}

export async function updateLembrete(id: string, updates: Partial<Lembrete>): Promise<void> {
    await requireSb().from('lembretes').update(updates).eq('id', id);
}

export async function deleteLembreteRecord(id: string): Promise<void> {
    await requireSb().from('lembretes').delete().eq('id', id);
}

// ═══ WHATSAPP GROUPS ═══
export async function fetchGrupos(): Promise<WhatsAppGrupo[]> {
    const { data } = await requireSb().from('whatsapp_grupos').select('*').order('nome');
    return data || [];
}

export async function insertGrupo(grupo: Partial<WhatsAppGrupo>): Promise<WhatsAppGrupo> {
    const { data, error } = await requireSb().from('whatsapp_grupos').insert(grupo).select().single();
    if (error) throw error;
    return data;
}

export async function deleteGrupo(id: string): Promise<void> {
    await requireSb().from('whatsapp_grupos').delete().eq('id', id);
}

// ═══ ALARMS ═══
export async function fetchAlarmes(): Promise<Alarme[]> {
    const { data } = await requireSb().from('alarmes')
        .select('*, alarme_destinatarios(*,usuarios(nome,photo_url))')
        .order('created_at', { ascending: false });
    return data || [];
}

export async function insertAlarme(alarme: Partial<Alarme>): Promise<Alarme> {
    const { data, error } = await requireSb().from('alarmes').insert(alarme).select().single();
    if (error) throw error;
    return data;
}

export async function updateAlarme(id: string, updates: Partial<Alarme>): Promise<void> {
    await requireSb().from('alarmes').update(updates).eq('id', id);
}

export async function deleteAlarmeRecord(id: string): Promise<void> {
    await requireSb().from('alarmes').delete().eq('id', id);
}

export async function insertAlarmeDestinatario(dest: Partial<AlarmeDestinatario>): Promise<void> {
    await requireSb().from('alarme_destinatarios').insert(dest);
}

export async function fetchPendingAlarms(userId: string): Promise<AlarmeDestinatario[]> {
    const { data } = await requireSb().from('alarme_destinatarios')
        .select('*,alarmes(*),usuarios(nome,photo_url)')
        .eq('user_id', userId)
        .in('status', ['pendente', 'adiado']);
    return data || [];
}

export async function updateAlarmeDestinatario(id: string, updates: Partial<AlarmeDestinatario>): Promise<void> {
    await requireSb().from('alarme_destinatarios').update(updates).eq('id', id);
}

// ═══ SEARCH ═══
export async function searchCards(query: string, limit = 30): Promise<Card[]> {
    const { data } = await requireSb().from('cards')
        .select('*,clients(name),usuarios(nome,photo_url),pipeline_stages(name,pipeline_id)')
        .ilike('title', `%${query}%`)
        .limit(limit);
    return data || [];
}

// ═══ RECURRING CARDS ═══
export async function fetchRecurringCards(): Promise<Card[]> {
    const { data } = await requireSb().from('cards')
        .select('*,clients(name),usuarios(nome,photo_url),pipeline_stages(name,pipeline_id)')
        .gt('recurrence_days', 0)
        .order('due_date', { ascending: true, nullsFirst: false });
    return data || [];
}

// ═══ WEBHOOKS ═══
export async function fireWebhook(event: string, payload: Record<string, any>): Promise<void> {
    try {
        await fetch(`${window.location.origin}/api/trello-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, ...payload })
        });
    } catch { /* fire and forget */ }
}

// ═══ NOTIFICATIONS ═══
export async function sendNotifications(userIds: string[], text: string, cardId?: string): Promise<void> {
    try {
        const sClient = requireSb();
        for (const uid of userIds) {
            await sClient.from('notifications').insert({
                user_id: uid,
                text,
                card_id: cardId || null,
                read: false,
            });
        }
    } catch { /* best effort */ }
}
