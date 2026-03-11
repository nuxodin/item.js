/**
 * HTTP Client for remote Item access
 * Creates remote Item instances that fetch data on demand via HTTP
 * Root is normal Item, children are AsyncItems that fetch their own data
 */

import { Item } from '../item.js';

/**
 * HTTP AsyncItem - fetches data from remote server on demand
 */
class HttpAsyncItem extends Item {

   constructor(parent, key) {
      super(parent, key);
      this.baseUrl = key == null ? (parent?.baseUrl ?? '') : `${parent.baseUrl}/${key}`;
   }

   async reader(signal) {
      const data = await httpFetch(this.baseUrl, 'GET', null, signal);
      if (Array.isArray(data)) data.forEach(({ key }) => this.item(key));
      else return data;
   }

   writer(value, signal) { return httpFetch(this.baseUrl, 'PUT', value, signal); }
   remove() {
      super.remove();
      return httpFetch(this.baseUrl, 'DELETE');
   }

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

const httpFetch = async (url, method = 'GET', data, signal) => {
   const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(data && { body: JSON.stringify(data) }),
      signal,
   });
   if (!res.ok) throw new Error(`HTTP ${res.status}`);

   const text = await res.text(); // ← statt res.json()
   return text ? JSON.parse(text) : undefined;

   return res.status !== 204 ? res.json() : undefined;
};
