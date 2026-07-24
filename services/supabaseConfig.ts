import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

export const supabase: SupabaseClient | null = isValidUrl
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const PROXY_BASE = `${window.location.origin}/api/supabase`;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export function createProxiedClient(): SupabaseClient | null {
    if (!isValidUrl) return null;

    // In localhost, connect directly (no mixed content issues on HTTP)
    if (IS_LOCAL) return createClient(supabaseUrl, supabaseAnonKey);

    const supabaseOrigin = new URL(supabaseUrl).origin;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            fetch: async (url: string | URL | Request, init?: RequestInit) => {
                const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

                // Route all Supabase requests through the proxy to avoid mixed content
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
