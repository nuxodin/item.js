# Item.js Tools

These tools extend Item.js with additional functionality for HTTP, WebSocket, database synchronization, and more.

## Core Tools

### `collectChanges.js` - Change Tracking

Collects and tracks changes to an Item tree for delta updates.

```javascript
import { collectChanges, patch } from './tools/collectChanges.js';

const root = item();
const tracker = collectChanges(root, () => {
    console.log('Change detected');
});

// Make changes
root.item('users').item('123').set({ name: 'Max' });

// Retrieve and reset changes
const { changes, deletions } = tracker.getAndReset();
// changes: { users: { 123: { name: 'Max' } } }
// deletions: {}

// Apply changes to another item
const target = item();
patch(target, { changes, deletions });
```

**Use Cases:**
- Offline-first synchronization
- Undo/redo functionality
- Delta updates for server

---

### `httpRouter.js` - HTTP REST API

Creates an HTTP router for Item structures. Enables remote access via REST API.

```javascript
import { createItemRouter } from './tools/httpRouter.js';

// Server (Deno/Node)
const rootItem = item();
const router = createItemRouter(rootItem, '/api');

// Mit Deno Serve
Deno.serve({ port: 3495 }, async (request) => {
    const response = await router(request);
    return response ?? new Response('Not Found', { status: 404 });
});
```

**Supported Methods:**
- `GET /path` - Retrieve value or keys
- `PUT /path` - Set value
- `PATCH /path` - Partial update
- `DELETE /path` - Remove item
- `OPTIONS /path` - Schema info

**Query Parameters:**
- `?$schema` - Retrieve JSON Schema

---

### `syncWith.js` - Object Synchronization

Synchronizes an Item with a regular JavaScript object (bidirectional).

```javascript
import { syncWith } from './tools/syncWith.js';

const root = item();
const obj = syncWith(root, {});

// Changes to Item reflect in object
root.item('test').set('hello');
console.log(obj.test); // 'hello'
```

⚠️ **Beta:** API may change.

---

### `jsonDataItem.js` - JSON File Synchronization

Synchronizes an Item bidirectionally with a JSON file.

```javascript
import { jsonDataItem } from './tools/jsonDataItem.js';

const jsonFile = fs.item('data.json');
const data = await jsonDataItem(jsonFile);

// Changes are automatically written to file
data.set({ users: [{ name: 'Max' }] });
```

**Features:**
- Debounced writes (1ms)
- Auto-parsing of JSON
- Bidirectional sync

---

## Schema Tools

### `schema/diff.js` - Schema Comparison

Compares JSON schemas and detects breaking changes.

```javascript
import { schemaDiff, jsonDiff } from './tools/schema/diff.js';

const oldSchema = { type: 'string', maxLength: 100 };
const newSchema = { type: 'string', maxLength: 50 };

const diffs = schemaDiff(newSchema, oldSchema);
// [{ path: ['maxLength'], destructive: true, msg: 'maxLength changed' }]
```

**Destructive changes detected:**
- Type changes
- Required field additions
- Enum value removals
- Constraint tightening (min, max, etc.)

---

### `schema/html/toInput.js` - HTML Input Generation

Generates HTML input elements from JSON Schema.

---

### `schema/db/*` - Database Tools

Conversion tools for various databases:

- **`mysql/`** - MySQL/MariaDB field mapping
- **`sqlite/`** - SQLite field mapping  
- **`indexeddb/`** - IndexedDB import/export

```javascript
import { toDb as mysqlToDb } from './tools/schema/db/mysql/to-db.js';
import { fromDb as mysqlFromDb } from './tools/schema/db/mysql/from-db.js';

// Schema to MySQL columns
const columns = mysqlToDb(jsonSchema);

// MySQL to schema
const schema = mysqlFromDb(tableSchema);
```

---

## Additional Tools

### `wsDenoRouter.js` - WebSocket Router

WebSocket router for real-time updates.

```javascript
import { createWsRouter } from './tools/wsDenoRouter.js';

const router = createWsRouter(rootItem);
// Manage WebSocket connections
// Push changes
```

---

## Usage

### Basic Import Structure

```javascript
// Core Item.js
import { item, effect } from './item.js';

// Tools as needed
import { createItemRouter } from './tools/httpRouter.js';
import { collectChanges } from './tools/collectChanges.js';
import { jsonDataItem } from './tools/jsonDataItem.js';
```

### Playground Examples

See `/tests/playground/` for complete examples:
- HTTP Client/Server
- WebSocket Sync
- Cookie-Driver
- JSON Editing

---

## Architecture

```
item.js (Core)
    ↓
tools/
    ├── httpRouter.js      → REST API
    ├── wsDenoRouter.js    → WebSocket
    ├── collectChanges.js  → Delta Tracking
    ├── jsonDataItem.js    → File Sync
    ├── syncWith.js        → Object Sync
    └── schema/
        ├── diff.js        → Schema Compare
        ├── html/          → UI Generation
        └── db/            → Database Adapters
```

All tools follow the principle: **Minimal, composable, Item-native**.
