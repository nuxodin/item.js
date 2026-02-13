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
      const item = rootItem.walkKeys(path);

      // OPTIONS: Return schema info
      if (method === 'OPTIONS') {
        return jsonResponse({
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          path: path,
          type: typeof item.get(),
        });
      }

      // GET: Return item value
      if (method === 'GET') {
        if (path.length > 0 && !item.filled) {
          return jsonResponse({ error: 'Path not found' }, 400);
        }
        const value = await item.promise;
        return jsonResponse(value);
      }

      // POST: Create/add to item (usually for nested items)
      if (method === 'POST') {
        const body = await request.json();
        if (typeof item.get() === 'object' && !Array.isArray(item.get())) {
          // If item is an object, POST adds a new key
          const newKey = body.key || `item_${Date.now()}`;
          item.item(newKey).set(body.value ?? body);
          return jsonResponse({ key: newKey, value: item.item(newKey).get() }, 201);
        } else {
          return jsonResponse({ error: 'Cannot POST to non-object item' }, 400);
        }
      }

      // PUT: Set/replace item value
      if (method === 'PUT') {
        const body = await request.json();
        item.set(body);
        return jsonResponse(await item.promise);
      }

      // PATCH: Partial update (merge for objects)
      if (method === 'PATCH') {
        const body = await request.json();
        const current = item.get();
        if (typeof current === 'object' && typeof body === 'object') {
          item.set({ ...current, ...body });
        } else {
          item.set(body);
        }
        return jsonResponse(await item.promise);
      }

      // DELETE: Remove item
      if (method === 'DELETE') {
        item.remove();
        return new Response(null, { status: 204 });
      }

      return jsonResponse({ error: 'Method not allowed' }, 405);

    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  };
}

/**
 * Helper: Create a JSON response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
