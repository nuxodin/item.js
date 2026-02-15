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

    // Subscribe to item changes
    const subscribe = (item) => {
      const key = item.keys.join('/');
      if (subscriptions.has(key)) return;

      const listener = ({ detail }) => {
        const data = detail.value;
        send({
          type: 'update',
          path: detail.item.keys,
          data,
        });
      };

      item.addEventListener('changeIn', listener);
      subscriptions.set(key, { item, listener });
    };

    const unsubscribe = (item) => {
      const key = item.keys.join('/');
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
        const item = rootItem.walkKeys(msg.path);

        switch (msg.action) {
          case 'get': {
            const data = await item.promise;
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