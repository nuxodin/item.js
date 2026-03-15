import { Hono } from 'jsr:@hono/hono';
import { createItemRouter } from '../../tools/httpRouter.js';
import { createItemWsRouter } from '../../tools/wsDenoRouter.js';
import { createDbAdmin } from './dbAdmin.js';

const app = new Hono();
const port = Number(Deno.env.get('PORT') ?? 3749);
const repoRoot = new URL('../../', import.meta.url);
const indexHtml = new URL('./index.html', import.meta.url);

const db = await createDbAdmin();
const httpRouter = createItemRouter(db, '/api');
const wsRouter = createItemWsRouter(db, '/ws');

app.get('/', async c => c.html(await Deno.readTextFile(indexHtml)));
app.get('/health', c => c.json({ ok: true }));

app.all('/api/*', c => httpRouter(c.req.raw));

app.get('/__repo/*', async c => {
    const rel = c.req.path.slice('/__repo/'.length);
    if (!/^[a-zA-Z0-9_./-]+$/.test(rel) || rel.includes('..')) return c.text('Bad path', 400);
    const fileUrl = new URL(rel, repoRoot);
    const source = await Deno.readTextFile(fileUrl);
    const type = rel.endsWith('.js') ? 'text/javascript' : 'text/plain';
    return new Response(source, { headers: { 'content-type': type } });
});

app.onError((error, c) => c.json({ error: error.message }, 500));

console.log(`dbAdmin: http://localhost:${port}`);
Deno.serve({ port }, async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/ws' && request.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
        return wsRouter(request);
    }
    return app.fetch(request);
});