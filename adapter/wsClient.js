/**
 * WebSocket Client for remote Item access
 */
import { Item } from '../item.js';

class WsAsyncItem extends Item {
    get _ws() {
        const root = this.root;
        return root.__ws ??= createConnection(root.wsUrl, root);
    }

    async reader() {
        const data = await this._ws.request({ action: 'get', path: this.path, subscribe: true });
        if (Array.isArray(data)) { // object
            for (const info of data) this.item(info.key);
        } else {
            return data;
        }
    }

    writer(value) {
        return this._ws.request({ action: 'set', path: this.path, value });
    }
    remove() {
        super.remove();
        return this._ws.request({ action: 'delete', path: this.path });
    }
    ChildClass = WsAsyncItem;
}

export function createItemClient(wsUrl) {
    const root = new WsAsyncItem(null, undefined);
    root.wsUrl = wsUrl.replace(/\/$/, '');
    root._ws; // trigger connection
    return root;
}

/**
 * Shared WebSocket connection
 */
function createConnection(wsUrl, root) {
    const url = wsUrl.startsWith('ws')
        ? wsUrl
        : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${wsUrl.startsWith('/') ? wsUrl : '/' + wsUrl}`;

    const ws = new WebSocket(url);
    console.debug?.('[ws-client] connecting', url);
    ws.addEventListener('open', () => console.debug?.('[ws-client] open'));
    ws.addEventListener('close', (ev) => console.debug?.('[ws-client] close', ev.code));
    ws.addEventListener('error', (ev) => console.error('[ws-client] error', ev));

    let requestId = 1;
    const pending = new Map();

    const request = (msg) => new Promise((resolve, reject) => {
        const id = requestId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, ...msg }));
    });

    ws.addEventListener('message', ({ data }) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'response' && msg.id != null) {
                const p = pending.get(msg.id);
                if (!p) return;
                pending.delete(msg.id);
                msg.status === 'ok' ? p.resolve(msg.data) : p.reject(new Error(msg.error || 'Request failed'));
                return;
            }
            if (msg.type === 'update' && Array.isArray(msg.path)) {
                const item = root.sub(msg.path);
                if (msg.add) item.item(msg.add);
                if (msg.remove) item.has(msg.remove)?.remove();
                if (msg.value !== undefined) item.io.setLocal(msg.value);
            }
        } catch (err) {
            console.error('[ws-client] parse/update error', err);
        }
    });

    return { request };
}