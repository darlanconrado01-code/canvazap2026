import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://147.93.66.8:8100';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const cache = new Map<string, { data: Buffer; status: number; headers: Record<string, string>; ts: number }>();
const CACHE_TTL_MS = 60000;
const CACHE_MAX = 500;

function cacheKey(url: string, method: string): string {
    return `${method}:${url}`;
}

function evictOld() {
    if (cache.size <= CACHE_MAX) return;
    const now = Date.now();
    for (const [k, v] of cache) {
        if (now - v.ts > CACHE_TTL_MS) cache.delete(k);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, Range, Count, x-supabase-api-version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const sbpath = (req.query.sbpath as string) || '';
    if (!sbpath) {
        return res.status(400).json({ error: 'Missing sbpath query parameter' });
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'sbpath') {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, v));
            } else if (value) {
                params.append(key, value);
            }
        }
    }
    const qs = params.toString();
    const targetUrl = `${SUPABASE_URL}/${sbpath}${qs ? '?' + qs : ''}`;

    if (req.method === 'GET') {
        const key = cacheKey(targetUrl, 'GET');
        const hit = cache.get(key);
        if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
            Object.entries(hit.headers).forEach(([k, v]) => res.setHeader(k, v));
            return res.status(hit.status).send(hit.data);
        }

        try {
            const upstream = await fetch(targetUrl, {
                method: 'GET',
                headers: buildHeaders(req),
                signal: AbortSignal.timeout(15000),
            });
            const headers: Record<string, string> = {};
            upstream.headers.forEach((value, key) => {
                const lower = key.toLowerCase();
                if (!['transfer-encoding', 'connection', 'content-encoding'].includes(lower)) {
                    headers[lower] = value;
                }
            });
            const body = Buffer.from(await upstream.arrayBuffer());

            evictOld();
            cache.set(key, { data: body, status: upstream.status, headers, ts: Date.now() });

            res.setHeader('X-Cache', 'MISS');
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
            Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
            return res.status(upstream.status).send(body);
        } catch (error: any) {
            return res.status(502).json({ error: 'Proxy error', message: error.message });
        }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const basePath = sbpath.split('?')[0];
        for (const k of cache.keys()) {
            if (k.includes(basePath)) cache.delete(k);
        }
    }

    try {
        const fetchInit: RequestInit = { method: req.method, headers: buildHeaders(req) };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (typeof req.body === 'string') {
                fetchInit.body = req.body;
            } else if (req.body) {
                fetchInit.body = JSON.stringify(req.body);
            }
        }

        const upstream = await fetch(targetUrl, fetchInit);

        upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase();
            if (!['transfer-encoding', 'connection', 'content-encoding'].includes(lower)) {
                res.setHeader(key, value);
            }
        });

        const body = await upstream.arrayBuffer();
        return res.status(upstream.status).send(Buffer.from(body));
    } catch (error: any) {
        return res.status(502).json({ error: 'Proxy error', message: error.message });
    }
}

function buildHeaders(req: VercelRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const h of ['content-type', 'authorization', 'apikey', 'prefer', 'range', 'count', 'x-supabase-api-version']) {
        if (req.headers[h]) {
            headers[h] = req.headers[h] as string;
        }
    }
    if (!headers['apikey'] && SUPABASE_ANON_KEY) {
        headers['apikey'] = SUPABASE_ANON_KEY;
    }
    return headers;
}
