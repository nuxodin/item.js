/**
 * HTTP router for Item structures
 * REST API: GET/POST/PUT/PATCH/DELETE/OPTIONS
 */

/**
 * Creates a router handler that responds to HTTP requests for Item access
 * @param {Item} rootItem - The root Item instance to expose
 * @param {string} [basePath=''] - Base path to listen on (e.g. '/api')
 * @returns {Function} Async handler (request) => Response
 */
export function createItemRouter(rootItem, basePath = '') {
    const prefixParts = basePath.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    const methods = {
        async GET({ path, url }) {
            const item = rootItem.sub(path);
            if (url.searchParams.has('$schema')) return jsonResponse(item.schema ?? null);
            const query = url.searchParams.has('q') ? JSON.parse(url.searchParams.get('q')) : null;
            await item.read(query);
            const value = item.get({ depth: query?.depth ?? 1 });
            return jsonResponse({value, depth: query?.depth ?? 1});
        },
        async PUT({ path, request }) {
            await rootItem.sub(path).set(await request.json());
            return jsonResponse({ success: true });
        },
        async PATCH({ path, request }) {
            await rootItem.sub(path).patch(await request.json());
            return jsonResponse({ success: true });
        },
        async DELETE({ path }) {
            await rootItem.has(path)?.remove();
            return new Response(null, { status: 204 });
        },
        async POST({ path, request }) {
            const newItem = await rootItem.sub(path).add(await request.json());
            return jsonResponse({ success: true, key: newItem.key });
        },
        async OPTIONS() {
            const headers = new Headers({'Access-Control-Max-Age': '86400'});
            return new Response(null, { status: 204, headers });
        },
    };

    return async (request) => {
        try {
            const url = new URL(request.url);
            const segments = url.pathname.split('/').filter(Boolean);
            if (prefixParts.some((p, i) => segments[i] !== p)) return null;
            const path = segments.slice(prefixParts.length);
            const handler = methods[request.method];
            if (!handler) return jsonResponse({ error: 'Method not allowed' }, 405);
            return await handler({ path, request, url });
        } catch (err) {
            return jsonResponse({ error: err.message }, 400);
        }
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}