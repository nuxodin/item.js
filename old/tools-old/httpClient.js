/**
 * HTTP Client for remote Item access
 * Creates remote Item instances that fetch data on demand via HTTP
 * Root is normal Item, children are AsyncItems that fetch their own data
 */

import { AsyncItem } from './AsyncItem.js';

/**
 * HTTP AsyncItem - fetches data from remote server on demand
 */
class HttpAsyncItem extends AsyncItem {

  constructor(parent, key) {
    super(parent, key);
    this.baseUrl = key == null ? (parent ? parent.baseUrl : '') : `${parent.baseUrl}/${key}`;
  }

  createGetter() {
    return httpGet(this.baseUrl).then((data) => {
      if (Array.isArray(data)) { // object
        data.map((info) => this.item(info.key));
        return Object.fromEntries(this.items().map((item) => [item.key, item.get()]));
      }
      return data;
    });
  }

  createSetter(value) {
    return httpPut(this.baseUrl, value);
  }

  async loadItems(){
    const data = await httpGet(this.baseUrl);
    data.forEach((info) => this.item(info.key));
  }

  remove() {
    super.remove();
    return httpDelete(this.baseUrl);
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
async function httpGet(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function httpPut(url, data) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function httpDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
