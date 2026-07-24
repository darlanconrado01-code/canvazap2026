import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://147.93.66.8:8100';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, Range, Count, x-supabase-api-version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Client sends ?sbpath=rest/v1/pipelines&select=name
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

    const headers: Record<string, string> = {};
    for (const h of ['content-type', 'authorization', 'apikey', 'prefer', 'range', 'count', 'x-supabase-api-version']) {
        if (req.headers[h]) {
            headers[h] = req.headers[h] as string;
        }
    }
    if (!headers['apikey'] && SUPABASE_ANON_KEY) {
        headers['apikey'] = SUPABASE_ANON_KEY;
    }

    try {
        const fetchInit: RequestInit = { method: req.method, headers };

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
