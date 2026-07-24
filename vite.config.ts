import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function supabaseProxyPlugin(): Plugin {
    const SUPABASE_URL = 'http://147.93.66.8:8100';
    return {
        name: 'supabase-proxy',
        configureServer(server) {
            server.middlewares.use('/api/supabase', async (req, res) => {
                const url = new URL(req.url || '/', `http://${req.headers.host}`);
                const sbpath = url.searchParams.get('sbpath') || '';
                if (!sbpath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing sbpath' }));
                    return;
                }
                const params = new URLSearchParams();
                url.searchParams.forEach((v, k) => { if (k !== 'sbpath') params.append(k, v); });
                const qs = params.toString();
                const target = `${SUPABASE_URL}/${sbpath}${qs ? '?' + qs : ''}`;
                const headers: Record<string, string> = {};
                for (const h of ['content-type', 'authorization', 'apikey', 'prefer', 'range', 'count', 'x-supabase-api-version']) {
                    const v = req.headers[h];
                    if (v) headers[h] = Array.isArray(v) ? v[0] : v;
                }
                if (!headers['apikey']) {
                    const key = server.config.env.VITE_SUPABASE_ANON_KEY || '';
                    if (key) headers['apikey'] = key;
                }
                try {
                    let body = '';
                    if (req.method !== 'GET' && req.method !== 'HEAD') {
                        body = await new Promise<string>((resolve) => {
                            let data = '';
                            req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                            req.on('end', () => resolve(data));
                        });
                    }
                    const upstream = await fetch(target, { method: req.method, headers, body: body || undefined });
                    const respHeaders: Record<string, string> = {};
                    upstream.headers.forEach((v, k) => {
                        const lower = k.toLowerCase();
                        if (!['transfer-encoding', 'connection', 'content-encoding'].includes(lower)) respHeaders[lower] = v;
                    });
                    const buf = Buffer.from(await upstream.arrayBuffer());
                    res.writeHead(upstream.status, respHeaders);
                    res.end(buf);
                } catch (err: any) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
                }
            });
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), supabaseProxyPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
