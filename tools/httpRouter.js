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
                    //type: typeof item.get(),
                });
            }

            // GET: Return item value
            if (method === 'GET') {
                if (url.searchParams.has('$schema')) return jsonResponse(item.schema ?? null);
                const query = url.searchParams.has('q') ? JSON.parse(url.searchParams.get('q')) : null;
                await item.read(query);
                return jsonResponse(item.get({ depth: query?.depth ?? 1 }));
            }

            // // GET: Return item value
            // if (method === 'GET') {
            //     if (url.searchParams.has('$schema')) return jsonResponse(item.schema ?? null);
            //     await item.io.get();
            //     const data = item.isObject ? item.keys.map(key => ({ key })) : item.value;
            //     //const data = item.isObject ? [...item].map(item => ({ key:item.key, meta: item.meta })) : item.value;
            //     return jsonResponse(data);
            // }

            // PUT: Set/replace item value
            if (method === 'PUT') {
                const body = await request.json();
                await item.set(body);
                return jsonResponse({success:true});
            }

            // PATCH: Partial update (merge for objects)
            if (method === 'PATCH') {
                const body = await request.json();
                await item.patch(body);
                return jsonResponse({success:true});
            }

            // DELETE: Remove item
            if (method === 'DELETE') {
                item.remove();
                return new Response(null, { status: 204 });
            }

            if (method === 'POST') {
                const body = await request.json();
                const newItem = await item.add(body);
                return jsonResponse({success:true, key:newItem.key});
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
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
