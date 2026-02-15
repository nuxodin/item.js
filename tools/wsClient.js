/**
 * WebSocket Client for remote Item access
 */
import { AsyncItem } from './AsyncItem.js';

class WsAsyncItem extends AsyncItem {
  getRoot() {
    let node = this;
    while (node.parent) node = node.parent;
    return node;
  }

  _ensureConnected() {
    const root = this.getRoot();
    if (!root._ws) root._ws = createConnection(root.wsUrl);
  }

  createGetter() {
    this._ensureConnected();
    return this.getRoot()._ws.request({ action: 'get', path: this.keys, subscribe: true });
  }

  createSetter(value) {
    this._ensureConnected();
    return this.getRoot()._ws.request({ action: 'set', path: this.keys, value });
  }

  remove() {
    super.remove();
    return this.getRoot()._ws.request({ action: 'delete', path: this.keys });
  }

  ChildClass = WsAsyncItem;
}

export function createItemClient(wsUrl) {
  const root = new WsAsyncItem(null, undefined);
  root.wsUrl = wsUrl.replace(/\/$/, '');
  root._ensureConnected();
  if (typeof window !== 'undefined') window.__ws_item_root = root;
  return root;
}

/**
 * Shared WebSocket connection
 */
function createConnection(wsUrl) {
  const url = wsUrl.startsWith('ws') 
    ? wsUrl 
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${wsUrl.startsWith('/') ? wsUrl : '/' + wsUrl}`;

  const ws = new WebSocket(url);
  
  console.debug?.('[ws-client] connecting', url);
  ws.addEventListener('open', () => console.debug?.('[ws-client] open'));
  ws.addEventListener('close', (ev) => console.debug?.('[ws-client] close', ev.code));
  ws.addEventListener('error', (ev) => console.error('[ws-client] error', ev));

  let requestId = 1;
  const pendingRequests = new Map();

  const request = (msg) => new Promise((resolve, reject) => {
    const id = requestId++;
    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, ...msg }));
  });

  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);

      if (msg.type === 'response' && msg.id != null) {
        const pending = pendingRequests.get(msg.id);
        if (pending) {
          pendingRequests.delete(msg.id);
          msg.status === 'ok' 
            ? pending.resolve(msg.data) 
            : pending.reject(new Error(msg.error || 'Request failed'));
        }
        return;
      }

      if (msg.type === 'update' && Array.isArray(msg.path)) {
        const root = window.__ws_item_root;
        if (root) {
          try {
            root.walkKeys(msg.path).asyncHandler.setLocal(msg.data);
          } catch {}
        }
      }
    } catch (err) {
      console.error('[ws-client] parse error', err);
    }
  });

  return { request };
}