import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

export const supabase: SupabaseClient | null = isValidUrl
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const PROXY_BASE = `${window.location.origin}/api/supabase`;

export function createProxiedClient(): SupabaseClient | null {
    if (!isValidUrl) return null;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            fetch: async (url: string | URL | Request, init?: RequestInit) => {
                const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
                let targetUrl = u;
                if (u.startsWith(PROXY_BASE + '/')) {
                    const rest = u.substring(PROXY_BASE.length + 1);
                    const qi = rest.indexOf('?');
                    const path = qi >= 0 ? rest.substring(0, qi) : rest;
                    const qs = qi >= 0 ? rest.substring(qi + 1) : '';
                    targetUrl = PROXY_BASE + '?sbpath=' + encodeURIComponent(path) + (qs ? '&' + qs : '');
                }
                return fetch(targetUrl, init);
            }
        }
    });

    return client;
}
