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

### io regions

> **An item is served by the nearest item at or above it that has a hook — its owner.
> All items sharing one owner form an io region, and the owner writes the region as one value.**

That single rule gives every shape you can build. There are no different *kinds* of item, only
different region sizes:

| Region | Where the hooks sit | Example |
|---|---|---|
| none | nowhere | plain local state, no `io` at all |
| whole subtree | root only, declared `readsFull = true` | JSON column, cookie, `localStorage` |
| one item each | every node (`static ChildClass = Self`) | REST, filesystem |

Because the owner writes the **whole** region, its children are set `{local:true}` and never
write themselves.

**Regions nest.** A descendant with its own hooks cuts a sub-region out of its ancestor's, and
the nearest owner wins — so every single change has exactly one route out. (A schema is the
opposite: `setSchema` throws if an ancestor already has one.)

But nest carefully: the outer owner still writes its whole region, so inner data would travel
through both channels. Where the two really are different sources — a JSON file inside a
filesystem tree — keep two trees and sync them, the way `jsonDataItem` does.

### readsFull + loaded — when are partial writes safe?

A partial write (child set, `patch`) writes the owner's **whole** region back. That erases
everything at the source the local tree has not seen — so it is only allowed when two things
hold, one static and one dynamic:

```js
owner.readsFull = true   // declaration: "my reader delivers the whole region"
owner.loaded             // did that value arrive? (io truth; children resolve to their owner)
```

- **`readsFull`** also changes `read()`: a plain-object reader return merges **deep**
  (no `{value, depth:true}` wrapper needed) — declared-full regions cannot end up with a
  keys-only tree.
- **`loaded`** becomes true only when the full region value went through io — reader,
  `setLocal`, `promise` assignment, or a landed write. Deliberately not: `set({local:true})`
  (also used for purely local state) and partial reads (a query slice must never license a
  full write). It **expires with `io.options.ttl`** — a stale region demands a fresh read.
  `filled` cannot play this role: it describes the local tree, and merely navigating to a
  child already sets it.

The guard (`full = readsFull ∧ loaded`):

| Write | needs |
|---|---|
| `owner.set(v)` — deliberate full replace | nothing |
| child set / `patch` into a writer-only region (no reader) | nothing — the tree is the only truth |
| child set / `patch` into a reader-region | `readsFull` **and** `loaded`, else it throws |

Strict (core) vs. convenient (`AsyncChild`) — same situation, two reactions:

| | unloaded region, child write |
|---|---|
| core | **throws** — nothing happens |
| [`AsyncChild.writer`](../tools/AsyncChild.js) | **reads first**, re-applies the change, then writes |

> **Open:** `AsyncChild` could probably be dropped entirely. Its one remaining job — a child
> writing its parent's whole value — is what regions now do by themselves
> (`Row.readsFull = true; ChildClass = Item` instead of `ChildClass = AsyncChild`, see
> `adapter/indexedDb.js`). What would be lost is the auto-read above: callers would have to
> `await region.read()` themselves, or the convenience moves into the core as an owner
> option. Not verified against the real adapter yet.

### How deep did the reader deliver

`read()` applies `{depth: 1}` — first level only. Two ways to deliver more: the owner
declares `readsFull` (plain object returns then merge deep), or the reader returns
`{value, depth}` (`depth: true` = whole tree). Same code fetches a folder listing or a
whole JSON document; only the declaration/return value differs.

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

### read(query)

A query is a **slice**: it bypasses io (io is by definition the whole value), calls the
reader directly and **patches** the result into the tree — nothing the slice does not
mention is removed, mentioned keys are updated. It never marks `loaded`: a slice must not
license a whole-region write.

```js
await table.read({ limit: 100 })   // reader(query) decides what the query means
```

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

No own `remover`? Then the removal is a partial write of the surrounding region: the
owner writes the region without the key — same licence as set/patch (`readsFull ∧ loaded`).

`local:true` for cases where the change comes from outside (filesystem watcher, WebSocket event, etc.) and the server is already aware.

---

## set / patch with {local}

```js
item.set(value)                  // $set + write via the ioOwner's writer
item.set(value, { local: true }) // $set only — no io
item.patch(value)                // like set, but merge — partial intent, needs the region licence
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