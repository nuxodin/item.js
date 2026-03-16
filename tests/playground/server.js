// deno
import { Hono } from 'jsr:@hono/hono';
import { fs } from "../../adapter/deno/fs.js";
import { createItemRouter } from "../../tools/httpRouter.js";
import { createItemWsRouter } from "../../tools/wsDenoRouter.js";
import { mqtt } from "../../adapter/deno/mqtt.js";

const PORT = 3495;

const serverRoot = fs('./files', { watch: true });
const mqttItem = await mqtt({url: 'mqtt://test.mosquitto.org:1883'});

const fileRouter = createItemRouter(serverRoot, '/files');
const wsRouter = createItemWsRouter(serverRoot, '/ws');
const mqttRouter = createItemWsRouter(mqttItem, '/mqtt');

const app = new Hono();

app.use('/files/*', async (c, next) => {
    await next();
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', '*');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
});
app.all('/files/*', (c) => fileRouter(c.req.raw));
app.all('/ws/*',    (c) => wsRouter(c.req.raw));
app.all('/mqtt/*', (c) => mqttRouter(c.req.raw));

console.log(`Playground server running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, app.fetch);