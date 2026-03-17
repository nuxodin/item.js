/**
 * WebSocket router for Item structures
 * JSON RPC protocol: get/set/delete/subscribe/unsubscribe
 */

export function createItemWsRouter(rootItem, basePath = '/ws') {
   const prefixParts = basePath.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

   const actions = {
      async get({ path, msg, subscribe }) {
         const item = rootItem.sub(path);
         await item.io.get();
         const data = item.isObject ? item.keys.map(key => ({ key })) : item.value;
         if (msg.subscribe) subscribe(item);
         return data;
      },
      async set({ path, msg }) {
         await rootItem.sub(path).set(msg.value);
      },
      async delete({ path }) {
         await rootItem.has(path)?.remove();
      },
      async post({ path, msg }) {
         const newItem = await rootItem.sub(path).add(msg.value);
         return { key: newItem.key };
      },
      async subscribe({ path }) {
         const item = rootItem.sub(path);
         subscribe(item);
         return await item.read(); // needed?
      },
      async unsubscribe({ path, unsubscribe }) {
         const item = rootItem.sub(path);
         unsubscribe(item);
      },
   };

   return async (request) => {
      const segments = new URL(request.url).pathname.split('/').filter(Boolean);
      if (prefixParts.some((p, i) => segments[i] !== p)) return null;

      // Require WebSocket upgrade
      if (!request.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
         return new Response('Expected WebSocket upgrade', { status: 400 });
      }

      const { socket, response } = Deno.upgradeWebSocket(request);
      const subscriptions = new Map(); // key: path string -> { item, listener }

      // Helper: send JSON message
      const send = (data) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(data));

      // Helper: send RPC response
      const respond = (id, status, data, error) => send({ id, type: 'response', status, ...data !== undefined && { data }, ...error && { error } });

      // todo
      // better subscription management: track which clients are subscribed to which items, and only send updates to those clients
      /*
      a.addEventListener('changeIn', (event) => {
          if (detail.add) console.log(event.target, 'added property', event.detail.add); // child-item
          if (detail.remove) console.log(event.target, 'removed property', event.detail.remove);
          if (detail.value !== undefined) console.log(event.target, 'value changed from', event.detail.oldValue, 'to', event.detail.value );
      });
      */

      // Subscribe to item changes
      const subscribe = (item) => {
         const key = item.path.join('/');
         if (subscriptions.has(key)) return;
         const listener = ({ target, detail }) => {
            // Simple payloads only — clients apply the exact change locally.
            const payload = { type: 'update', path: target.path };
            if (detail.add)             payload.add = detail.add.key;
            else if (detail.remove)     payload.remove = detail.remove.key;
            else if ('value' in detail) payload.value = detail.value;
            send(payload);
         };
         item.addEventListener('changeIn', listener);
         subscriptions.set(key, { item, listener });
      };

      const unsubscribe = (item) => {
         const key = item.path.join('/');
         const sub = subscriptions.get(key);
         if (!sub) return;
         sub.item.removeEventListener('changeIn', sub.listener);
         subscriptions.delete(key);
      };

      socket.onmessage = async (ev) => { // Handle incoming messages
         let id;
         try {
            const msg = JSON.parse(ev.data);
            id = msg.id;
            const handler = actions[msg.action];
            if (!handler) return respond(id, 'error', undefined, `Unknown action: ${msg.action}`);
            const data = await handler({ path:msg.path, msg, subscribe, unsubscribe });
            respond(id, 'ok', data);
         } catch (err) {
            console.error('[ws-router] error', err);
            respond(id, 'error', undefined, err.message || String(err));
         }
      };

      socket.onclose = () => subscriptions.forEach(({ item }) => unsubscribe(item));

      return response;
   };
}