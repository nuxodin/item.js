/**
 * WebSocket router for Item structures
 * JSON RPC protocol: get/set/delete/subscribe/unsubscribe
 */

export function createItemWsRouter(rootItem, basePath = '/ws') {
  const pathPrefix = basePath.replace(/^\/|\/$/g, '');
  const prefixLength = pathPrefix ? pathPrefix.split('/').length : 0;

  return async (request) => {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    
    // Validate path prefix
    if (pathPrefix && segments.slice(0, prefixLength).join('/') !== pathPrefix) {
      return new Response(null, { status: 404 });
    }

    // Require WebSocket upgrade
    if (!request.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
      return new Response('Expected WebSocket upgrade', { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(request);
    const subscriptions = new Map(); // key: path string -> { item, listener }
    
    // Helper: send JSON message
    const send = (data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    };

    // Helper: send RPC response
    const respond = (id, status, data, error) => {
      const payload = { id, type: 'response', status };
      if (data !== undefined) payload.data = data;
      if (error) payload.error = error;
      send(payload);
    };


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

      const listener = ({ detail }) => {
        // Simple payloads only — clients apply the exact change locally.
        const payload = { type: 'update', path: detail.item.path };
        if (detail.add) {
          payload.add = detail.add.key;
        } else if (detail.remove) {
          payload.remove = detail.remove.key;
        } else if (Object.prototype.hasOwnProperty.call(detail, 'value')) {
          payload.value = detail.value;
        }
        send(payload);
      };

      item.addEventListener('changeIn', listener);
      subscriptions.set(key, { item, listener });
    };

    const unsubscribe = (item) => {
      const key = item.path.join('/');
      const sub = subscriptions.get(key);
      if (sub) {
        sub.item.removeEventListener('changeIn', sub.listener);
        subscriptions.delete(key);
      }
    };

    socket.onmessage = async (ev) => { // Handle incoming messages
      let msg, id;
      try {
        msg = JSON.parse(ev.data);
        id = msg.id;
        const item = rootItem.sub(msg.path);

        switch (msg.action) {
          case 'get': {
            const data = await item.promise;
            respond(id, 'ok', data);
            if (msg.subscribe) subscribe(item);
            break;
          }

          case 'list': {
            await item.loadItems();
            const data = item.keys;
            respond(id, 'ok', data);
            if (msg.subscribe) subscribe(item);
            break;
          }
          
          case 'set': {
            await item.set(msg.value);
            const data = await item.promise;
            respond(id, 'ok', data);
            break;
          }
          
          case 'delete': {
            await item.remove();
            respond(id, 'ok');
            break;
          }
          
          case 'subscribe': {
            subscribe(item);
            const data = await item.promise;
            respond(id, 'ok', data);
            break;
          }
          
          case 'unsubscribe': {
            unsubscribe(item);
            respond(id, 'ok');
            break;
          }
          
          default:
            respond(id, 'error', undefined, `Unknown action: ${msg.action}`);
        }
      } catch (err) {
        console.error('[ws-router] error', err);
        respond(id, 'error', undefined, err.message || String(err));
      }
    };

    socket.onclose = () => {
      subscriptions.forEach(sub => unsubscribe(sub.item));
    };

    return response;
  };
}