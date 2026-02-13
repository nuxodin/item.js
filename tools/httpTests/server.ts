/**
 * Test server for httpRouter + httpClient
 * Serves /api (REST API) and / (web UI)
 * $ cd ./tools/httpTests && deno run -A server.ts
 */

import { item } from '../../item.js';
import { createItemRouter } from '../httpRouter.js';

const PORT = 3750;

const serverRoot = item({
  users: {
    '44': { name: 'Alice', age: 30 },
    '123': { name: 'Bob', age: 25 },
  },
  config: { theme: 'dark', lang: 'en' },
});
serverRoot.item('items').set({});

const router = createItemRouter(serverRoot, '/api');

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith('/api')) {
    try {
      const response = await router(req);
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', '*');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return new Response('Not Found', { status: 404 });
};

console.log(`HTTP Tests: http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);
