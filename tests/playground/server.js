// deno

import { fs } from "../../adapter/deno/fs.js";
import { createItemRouter } from "../../tools/httpRouter.js";
import { createItemWsRouter } from "../../tools/wsDenoRouter.js";

const PORT = 3495;

// Use the real filesystem from the files directory
const serverRoot = fs('./files', { watch: true });

const router = createItemRouter(serverRoot, '/files');
const wsRouter = createItemWsRouter(serverRoot, '/ws');

const handler = async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith('/ws')) {
    try {
      return await wsRouter(req);
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (pathname.startsWith('/files')) {
    try {
      const response = await router(req);
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', '*');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      return response;
    } catch (err) {
        console.log(err)
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Not Found', { status: 404 });
};

console.log(`Playground server running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);

