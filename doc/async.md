# item.js — Async API

## Mental model

> **The item tree is the cache. `io` is only transport.**

Applies to async items — those with a `reader`/`writer`. Purely local items have no `io`.

| Question | Answered by |
|---|---|
| *Which slice?* — depth, subtree, query | the **tree** |
| *Running? done? failed?* | **`io`** |

An `AsyncDataPoint` has exactly one value, one getter, one setter — it cannot hold two
slices of the same item. Hence `read(query)` cannot go through `io.get()`.

### Who writes what

A `writer` owns its **whole subtree**: `set()` passes it `get({silent:true})`, so children
are set `{local:true}` and never write themselves.

Writers are **not inherited**. Setting a child that has no writer of its own does no io —
the value stays local and `set()` returns `undefined`.

Match that to the data source:

| Source | Children write themselves | How |
|---|---|---|
| Per-node addressable (REST, fs) | yes | `static ChildClass = Self` |
| Whole-blob only (JSON column, cookie) | no, only the root | `AsyncChild` |

### How deep did the reader deliver

`read()` applies `{depth: 1}` — first level only. A reader that delivered more returns
`{value, depth}` (`depth: true` = whole tree). Same code fetches a folder listing or a
whole JSON document; only the reader's return value differs.

---

## reader / writer / adder / remover

Hooks that connect an item to a data source. All optional, defined on the prototype or per instance.

| Hook | HTTP | When |
|---|---|---|
| `reader` | GET | `read()`, `for await` |
| `writer` | PATCH | `set()` — except `{local:true}` |
| `adder` | POST | `await add(value)` |
| `remover` | DELETE | `remove()` — except `{local:true}` |

### reader return value

The `reader` is responsible for determining whether its item is a leaf or a collection. It must return:

- **primitive** (string, number, null, ...) → item becomes a leaf node, value is set
- **object** → item becomes an object, but only the keys of the object are created as children, the values are not set! The subitem must be read separately.
- **`undefined`** → reader added children itself via `this.item(key)` — no further `$set`

The third pattern is the most flexible, as it gives full control over which children are created and what values they receive:

```js
async reader(query, options) {
    const data = await httpFetch(this.url, 'GET', null, options?.signal)
    if (Array.isArray(data)) {
        // collection: create children with values, no second writer call
        for (const row of data) this.item(row.id).set(row, { local: true })
    } else {
        return data // primitive or object → $set handles it
    }
}
```

---

## io / AsyncDataPoint

Created automatically when `reader` or `writer` is present. Do not instantiate directly.

```js
item.io          // AsyncDataPoint instance (lazy)
item.pending     // true while reader/writer is running
item.error       // last error or undefined
item.promise     // assign a promise directly
```

### Options

```js
item.io.options.ttl        = 5000  // cache duration in ms
item.io.options.optimistic = true  // accept writer value immediately
item.io.options.debounceMs = 5     // writer debounce
```

---

## read()

Explicitly load data — waits for `reader`, returns a `Promise` that resolves with `undefined` when the reader is done.

```js
const value = await item.read()
```

Use when you need to ensure data is loaded before reading it.

---

## add(value)

Create a new child with an auto-generated key — with or without a server.

```js
const newItem = await users.add({ name: 'Hans', age: 33 })
newItem.key  // UUID (no adder) or server ID (with adder)
```

- With `adder`: POST → server returns `{ key, value? }` or just `key`
- Without `adder`: `generateKey()` → UUID
- Sets value via `set({local:true})` — no second writer call

### generateKey()

Override for a custom key strategy:

```js
class MyItem extends Item {
    generateKey() { return Date.now() }
}
```

Default: `crypto.randomUUID()`

---

## remove(options)

```js
await item.remove()                // remover() + remove locally
await item.remove({ local: true }) // local only — no remover()
```

`local:true` for cases where the change comes from outside (filesystem watcher, WebSocket event, etc.) and the server is already aware.

---

## set / patch with {local}

```js
item.set(value)                  // $set + writer
item.set(value, { local: true }) // $set only — no writer
item.patch(value)                // like set, but merge instead of replace
```

`local:true` propagates through the entire tree — children also call `set({local:true})` and `remove({local:true})`.

---

## promise

Direct promise assignment — useful for one-off async loads:

```js
item.promise = fetch('/api/config').then(r => r.json())
item.pending  // true while pending
item.error    // set on reject
```

New assignment cancels the previous one (race-safe).

---

## Async Iterator

Yields existing children, then new ones as `reader` adds them via `this.item(key)`:

```js
for await (const child of collection) {
    console.log(child.key)
}
```

Runs until the item is cleared or removed.

---

## io.setLocal(value)

Set a value without triggering the writer — uses TTL cache, prevents unnecessary re-fetch:

```js
// e.g. in a filesystem watcher:
targetItem.io.setLocal(newContents)
```

Difference from `set({local:true})`: goes directly through `io`, sets TTL cache, does not trigger a `set` event.

---

## Change Events (async-relevant)

```js
item.addEventListener('change', ({ pending, error, value }) => {
    if (pending) // reader/writer is running
    if (error)   // failed
    if (value !== undefined) // value changed
})
```

---

## Adapter Example: HTTP REST

```js
class HttpItem extends Item {
    get url() {
        return this.root.baseUrl + '/' + this.path.join('/')
    }
    async reader(query, options) {
        const data = await httpFetch(this.url, 'GET', null, options?.signal)
        if (Array.isArray(data)) {
            for (const row of data) this.item(row.id).set(row, { local: true })
        } else {
            return data
        }
    }
    writer(value, options) {
        return httpFetch(this.url, 'PATCH', value, options?.signal);
    }
    adder(value) {
        return httpFetch(this.url, 'POST', value).then(r => ({ key: r.id, value: r }))
    }
    remover() {
        return httpFetch(this.url, 'DELETE')
    }
    static ChildClass = HttpItem
}
```

---

## Adapter Example: Filesystem (Deno)

```js
class FsItem extends Item {
    get fsPath() {
        return this.parent == null ? this.fsRootPath : this.parent.fsPath + '/' + this.key
    }
    async reader() {
        const info = await Deno.stat(this.fsPath).catch(() => null)
        if (!info) return null
        if (info.isFile) return Deno.readTextFile(this.fsPath)
        for await (const e of Deno.readDir(this.fsPath)) this.item(e.name)
    }
    writer(value) {
        return Deno.writeTextFile(this.fsPath, value)
    }
    remover() {
        return Deno.remove(this.fsPath, { recursive: true })
            .catch(e => { if (!(e instanceof Deno.errors.NotFound)) throw e })
    }
    static ChildClass = FsItem
}
```

Filesystem watcher:
```js
for await (const event of Deno.watchFs(rootPath)) {
    const item = root.sub(relativePath(event).split('/'))
    if (event.kind === 'modify') item.io.setLocal(await Deno.readTextFile(item.fsPath))
    if (event.kind === 'remove') item.remove({ local: true })
}
```