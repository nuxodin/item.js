# Item.js Adapters

Adapters are **Item classes or Item factories** that connect Item.js to external data sources. They extend `Item` and override `reader()`/`writer()` for automatic data synchronization.

## Overview

| Adapter | Environment | Data Source |
|---------|-------------|-------------|
| `deno/fs` | Server (Deno) | Filesystem |
| `cookie` | Browser | `cookieStore` API |
| `storage` | Browser | `localStorage` / `sessionStorage` |
| `httpClient` | Universal | HTTP REST API |
| `wsClient` | Browser | WebSocket |

---

## Filesystem Adapter (`deno/fs`)

**Class:** `FsItem extends Item`  
**Factory:** `fs(rootPath, options)`

```javascript
import { fs } from './adapter/deno/fs.js';

// Create root
const files = fs('/path/to/files', { watch: true });

// Read
const content = await files.item('README.md').promise;

// Write
await files.item('test.txt').set('Hello World');

// List directory
for (const child of files.items()) {
    console.log(child.key); // 'README.md', 'test.txt'
}
```

**Features:**
- **Auto-Watch:** `{ watch: true }` → Real-time updates on file changes
- **Lazy Loading:** Files are only read on access
- **Path Normalization:** Correct handling of relative paths

**Methods:**
- `fsPath` - Absolute path in filesystem
- `io.setLocal(value)` - Set local value (without writing)

---

## Cookie Adapter (`cookie`)

**Classes:** `CookieStore extends Item`, `CookieItem extends Item`

```javascript
import { cookie } from './adapter/cookie.js';

// Set cookie
await cookie.item('username').set('max');

// Read cookie
const name = await cookie.item('username').promise;

// Delete cookie
cookie.item('username').remove();

// Show all cookies
for (const c of cookie.items()) {
    console.log(c.key, c.value);
}
```

**Features:**
- **CookieStore API:** Uses native browser API
- **Auto-Expire:** 2 years default
- **Live Updates:** `cookieStore.addEventListener('change')`
- **TTL:** 10 seconds cache

**Special:**
- `CookieItem.ChildClass = false` → No nested cookies
- Values are automatically converted to string

---

## Storage Adapter (`storage`)

**Classes:** `StorageItem extends Item`

```javascript
import { local, session, jsonItem } from './adapter/storage.js';

// localStorage
await local.item('settings').set(JSON.stringify({ theme: 'dark' }));
const settings = JSON.parse(await local.item('settings').promise);

// sessionStorage
await session.item('token').set('abc123');

// Use as JSON-Object (bidirectional)
const data = await jsonItem('myData', local);
data.set({ count: 42, items: ['a', 'b'] });
// Automatically saved as JSON
```

**Features:**
- **Sync Events:** `addEventListener('storage')` for cross-tab sync
- **Auto-String:** All values stored as strings
- **JSON Helper:** `jsonItem()` for object synchronization

**Exports:**
- `local` - `localStorage` wrapper
- `session` - `sessionStorage` wrapper
- `jsonItem(name, storage)` - JSON-Object sync

---

## HTTP Client Adapter (`httpClient`)

**Class:** `HttpAsyncItem extends Item`  
**Factory:** `createItemClient(baseUrl)`

```javascript
import { createItemClient } from './adapter/httpClient.js';

// Create client
const api = createItemClient('http://localhost:3000/api');

// Load keys (list of children)
await api.loadItems();
for (const child of api.items()) {
    console.log(child.key);
}

// Read value
const user = await api.item('users').item('123').promise;

// Write value
await api.item('users').item('123').set({ name: 'Max' });

// Delete
api.item('users').item('123').remove();
```

**HTTP Mapping:**
| Item Operation | HTTP Method | URL |
|----------------|-------------|-----|
| `loadItems()` | `GET` | `/api` → Array of `{key}` |
| `promise` | `GET` | `/api/item` → Value |
| `set(value)` | `PUT` | `/api/item` |
| `remove()` | `DELETE` | `/api/item` |

**Features:**
- **Lazy Loading:** Data is only fetched on access
- **Signal Support:** AbortController for cancellation
- **Auto-Keys:** Load child keys from server

---

## WebSocket Client Adapter (`wsClient`)

**Class:** `WsAsyncItem extends Item`  
**Factory:** `createItemClient(wsUrl)`

```javascript
import { createItemClient } from './adapter/wsClient.js';

// Create client
const ws = createItemClient('ws://localhost:3000/ws');

// Real-time updates
ws.item('chat').item('messages').addEventListener('changeIn', (e) => {
    console.log('New message:', e.detail);
});

// Set value (immediately sent to server)
await ws.item('chat').item('messages').item(Date.now()).set({
    text: 'Hello!',
    user: 'max'
});
```

**WebSocket Protocol:**
```javascript
// Client → Server
{ action: 'get', path: ['chat', 'messages'], subscribe: true }
{ action: 'set', path: ['chat', 'messages', '123'], value: {...} }
{ action: 'delete', path: ['chat', 'messages', '123'] }

// Server → Client (Updates)
{ type: 'update', path: ['chat', 'messages'], add: '123' }
{ type: 'update', path: ['chat', 'messages', '123'], value: {...} }
{ type: 'update', path: ['chat', 'messages'], remove: '123' }
```

**Features:**
- **Bidirectional:** Changes are pushed
- **Auto-Reconnect:** Connection is managed
- **Subscription:** `subscribe: true` for live updates
- **Request/Response:** Promise-based requests

---

## Adapter Architecture

### Item Extension Pattern

```javascript
class MyAdapterItem extends Item {
    // 1. Read data (async)
    async reader() {
        return fetchData(this.key);
    }
    
    // 2. Write data (async)
    async writer(value) {
        return saveData(this.key, value);
    }
    
    // 3. Define child class
    static ChildClass = MyAdapterItem;
    // or: static ChildClass = false; // No children
}
```

### Factory Pattern

```javascript
export function createMyAdapter(config) {
    const root = new MyAdapterItem(null, undefined);
    root.config = config;
    return root;
}
```

### Auto-Sync Pattern

```javascript
// external events → Item
externalApi.addEventListener('change', (e) => {
    const item = root.sub(e.path);
    item.io.setLocal(e.value); // Set locally, don't write!
});
```

---

## Comparison: Adapters vs Tools

| | Adapters | Tools |
|---|---|---|
| **Basis** | Extends `Item` | Uses `Item` API |
| **Purpose** | Connect data sources | Extend functionality |
| **API** | `reader()`, `writer()` | Various functions |
| **Examples** | `fs`, `cookie`, `httpClient` | `collectChanges`, `jsonDataItem` |
| **Usage** | `const data = adapter.item('key')` | `const result = tool(item)` |

---

## Best Practices

1. **Reader/Writer always async** → Enables network/file operations
2. **`io.setLocal()` for external events** → Prevents infinite loops
3. **Define `ChildClass`** → Consistent behavior for children
4. **Error Handling** → Catch network/file errors
5. **Cleanup** → Close connections, remove listeners

---

## Creating Custom Adapters

```javascript
import { Item } from './item.js';

class MyAdapterItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        // Initialization
    }
    
    async reader() {
        // Read data from source
        // Return: value or undefined (for objects)
    }
    
    async writer(value) {
        // Write data to source
        // Return: Promise
    }
    
    static ChildClass = MyAdapterItem;
}

export function createMyAdapter(config) {
    const root = new MyAdapterItem(null, undefined);
    // Setup
    return root;
}
```

See existing adapters as reference implementations.
