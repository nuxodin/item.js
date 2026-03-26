import { Item } from '../item.js';

class HttpAsyncItem extends Item {

   constructor(parent, key) {
      super(parent, key);
      this.baseUrl = key == null ? (parent?.baseUrl ?? '') : `${parent.baseUrl}/${encodeURIComponent(key)}`;
   }

   async reader(query, options) {
      const url = this.baseUrl + buildQuery(query);
      const data = await httpFetch(url, 'GET', null, options?.signal);
      if (Array.isArray(data)) data.forEach(({ key }) => this.item(key));
      else return data;
   }

   //writer(value, options) { return httpFetch(this.baseUrl, 'PATCH', value, options?.signal); }
   writer(value, options) { return httpFetch(this.baseUrl, 'PUT', value, options?.signal); }
   remover() { return httpFetch(this.baseUrl, 'DELETE'); }
   adder(value) { return httpFetch(this.baseUrl, 'POST', value); }

   ChildClass = HttpAsyncItem;
}
/**
 * Creates a remote Item that fetches data on demand
 * Root is normal Item, all descendants are AsyncItems
 * @param {string} baseUrl - Base URL to remote item (e.g. 'http://localhost:3000/api')
 * @returns {Item} Root item with async children
 */
export function createItemClient(baseUrl) {
   baseUrl = baseUrl.replace(/\/$/, '');
   const root = new HttpAsyncItem(null, undefined);
   root.baseUrl = baseUrl;
   return root;
}

/**
 * HTTP helpers
 */

/** @param {string} url
 *  @param {string} [method]
 *  @param {any} [data]
 *  @param {AbortSignal} [signal]
 */
const httpFetch = async (url, method = 'GET', data, signal) => {
   const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(data && { body: JSON.stringify(data) }),
      signal,
   });
   if (!res.ok) throw new Error(`HTTP ${res.status}`);
   const text = await res.text();
   return text ? JSON.parse(text) : undefined;
};

/** @param {object} query */
const buildQuery = (query) => {
    if (!query) return '';
    return '?' + new URLSearchParams({ q: JSON.stringify(query) });
};