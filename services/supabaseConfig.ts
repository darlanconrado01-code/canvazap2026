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

    const supabaseOrigin = new URL(supabaseUrl).origin;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            fetch: async (url: string | URL | Request, init?: RequestInit) => {
                const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

                // If the URL points to the Supabase server, route through the proxy
                if (u.startsWith(supabaseOrigin + '/')) {
                    const pathAndQuery = u.substring(supabaseOrigin.length + 1);
                    const qi = pathAndQuery.indexOf('?');
                    const path = qi >= 0 ? pathAndQuery.substring(0, qi) : pathAndQuery;
                    const qs = qi >= 0 ? pathAndQuery.substring(qi + 1) : '';
                    const proxyUrl = PROXY_BASE + '?sbpath=' + encodeURIComponent(path) + (qs ? '&' + qs : '');
                    return fetch(proxyUrl, init);
                }

                return fetch(u, init);
            }
        }
    });

    return client;
}
