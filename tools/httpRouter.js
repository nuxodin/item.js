/**
 * Generic HTTP Router for Item structures
 * Enables remote access to Item instances via HTTP REST API
 * 
 * Usage (Node/Deno):
 *   import { createItemRouter } from './httpRouter.js';
 *   const router = createItemRouter(rootItem);
 *   // Use with your HTTP server (Deno, Node, etc)
 */

/**
 * Creates a router handler that responds to HTTP requests for Item access
 * @param {Item} rootItem - The root Item instance to expose
 * @param {string} [basePath=''] - Base path to listen on (e.g. '/api')
 * @returns {Function} Async handler (request) => Response
 */
export function createItemRouter(rootItem, basePath = '') {
    const pathPrefix = basePath ? basePath.replace(/^\/|\/$/g, '') : '';
    const prefixLength = pathPrefix ? pathPrefix.split('/').length : 0;

    return async (request) => {
        try {
            const url = new URL(request.url);
            const allSegments = url.pathname.split('/').filter(Boolean);

            // Check if request matches basePath
            if (pathPrefix && !allSegments.slice(0, prefixLength).join('/').startsWith(pathPrefix)) {
                return jsonResponse({ error: 'Not Found' }, 404);
            }

            const path = allSegments.slice(prefixLength);
            const method = request.method;
            const item = rootItem.sub(path);

            // OPTIONS: Return schema info
            if (method === 'OPTIONS') {
                return jsonResponse({
                    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                    path: path,
                    type: typeof item.get(),
                });
            }

            // GET: Return item value
            // todo: this gets the full value, maybe we want just the value if primitive or the children if object? or maybe a query param to control this?
            if (method === 'GET') {
                try {
                    await item.loadItems();
                } catch {}
                const items = item.items();
                let value = null;
                if (items === null) {
                    value = await item.promise;
                } else {
                    value = items.map(item=>({key: item.key}));
                }
                return jsonResponse(value);
            }

            // PUT: Set/replace item value
            if (method === 'PUT') {
                const body = await request.json();
                item.set(body);
                const value = await item.promise;
                return jsonResponse(value);
            }

            // PATCH: Partial update (merge for objects)
            if (method === 'PATCH') {
                const body = await request.json();
                patch(item, body);
                const value = await item.promise;
                return jsonResponse(value);
            }

            // DELETE: Remove item
            if (method === 'DELETE') {
                item.remove();
                return new Response(null, { status: 204 });
            }

            return jsonResponse({ error: 'Method not allowed' }, 405);

        } catch (err) {
            console.log(err);
            console.log(err.message)
            return jsonResponse({ error: err.message }, 400);
        }
    };
}


/**
 * Helpers
 */
function patch(item, updates) {
    if (item.constructor.isPrimitive(updates)) {
        // Primitive Werte direkt setzen
        item.set(updates);
    } else {
        // Objekte: rekursiv nur die vorhandenen Keys updaten
        for (const key in updates) {
            patch(item.item(key), updates[key]);
        }
    }
}
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
