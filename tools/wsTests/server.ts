/**
 * Test server for wsRouter + wsClient
 * $ cd ./tools/wsTests && deno run -A server.ts
 */

import { item } from '../../item.js';
import { createItemWsRouter } from '../wsDenoRouter.js';

const PORT = 3755;

const serverRoot = item({
  users: {
    '44': { name: 'Alice', age: 30 },
    '123': { name: 'Bob', age: 25 },
  },
  config: { theme: 'dark', lang: 'en' },
});

const router = createItemWsRouter(serverRoot, '/ws');

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith('/ws')) {
    try {
      return await router(req);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response('Not Found', { status: 404 });
};

// Make a server-side mutation after a short delay so clients can observe push updates
setTimeout(() => {
  serverRoot.item('config').item('theme').set('light');
  // revert after a while if you like
  setTimeout(() => serverRoot.item('config').item('theme').set('dark'), 2000);
}, 200);

let i = 0;
setInterval(() => {
    serverRoot.item('iterate').value = i++;
}, 1000);

console.log(`WS Tests: http://localhost:${PORT}`);
// listen on IPv6/IPv4 so `localhost` resolving to ::1 (Firefox) works as well
Deno.serve({ hostname: '::', port: PORT }, handler);
