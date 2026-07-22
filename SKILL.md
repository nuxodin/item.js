---
name: item.js
description: >
  Use this skill whenever the user works with item.js — a reactive state library based on
  a tree of Item nodes with signals, effects, and proxy support. Trigger for: creating/reading/
  writing Items, using effect(), proxy traps, async/promise state, event handling, custom
  subclasses, or debugging reactive code built with this library.
---

# item.js

```js
import { item, effect, $item } from 'https://cdn.jsdelivr.net/gh/nuxodin/item.js@main/item.js' // if not selfhosted
```

## Item

```js
i = item()
i = item(42)
i = item({ a: 1, b: { b1: 2 } })

// !!! Primitive values live directly on the item.
// !!! Objects turn the item into a container of child items.

i.value
i.value = 99
i.get()           // = i.value, registers effect dependency
i.set(99)
i.patch({ a: 2 }) // merge, keeps unmentioned keys
i.filled          // false until first set

// set replaces, patch merges:
i = item({ a: 1, b: 2 })
i.value = { b: 3 }   // → { b: 3 }       'a' removed
i.patch({ b: 3 })    // → { a: 1, b: 3 } 'a' kept (deep)

// equality: Object.is
i = item(NaN); i.value = NaN  // no change event
i = item(0);   i.value = -0   // change fires

i.item('key')     // get/create child Item, fires change on parent !!! Autovivification
i.has('key');     // subitem / undefined
i.has('key')?.remove();
subsub = i.has('sub', 'subsub') // undefined if any key missing
i.keys            // string[], registers effect dep
i.items()         // Item[]
b = i.sub('a', 'b')   // i.item('a').item('b'), accepts array/spread/mixed
b.key             // 'b' (undefined for root)
b.parent          // a (undefined for root)
b.path            // ['a','b'] ([] for root)
b.remove()        // fires change on parent, root throws
b.root            // root Item

for (const child of i) { }

JSON.stringify(i) // → i.get()
`${i}`            // primitive: String(value ?? ''); object: key or ''
+i                // primitive: Number(value); object: NaN


## effect()

```js
const dispose = effect(() => {// runs immediately
    count.value  // .get() / .value / .has() / .keys register as dep
})
count.value = 1; // no effect
count.value = 2; // effect runs after batched microtask
dispose()
```

## Proxy

```js
p = i.proxy

p()              // i.get(), or i.promise if pending
p(42)            // i.set(42), returns true or Promise
p(1, 2)          // throws
'p:' + p         // 'p:42' / null 'p:null'
`p:${p}`         // 'p:42' / null 'p:'
++p;             // 43
p.xyz            // child proxy (auto-created)
p.xyz = v
p.then           // Proxys are thenable, "then" is the only reserved property
delete p.xyz     // i.item('xyz').delete()
'xyz' in p
Object.keys(p)
{ ...p }                 // { xyz: Proxy, ... }
Object.assign(p, src)    // sets each key on underlying items
p[$item]                 // underlying Item
for (const c of p) { }   // child proxies
for await (const c of p) { } // calls reader
await p;                 // calls reader() and awaits the promise
JSON.stringify(p())      // ✓
```

## Events

```js
// fire on item
i.addEventListener('set',    e => e) // { target, oldValue, value, options } — preventable
i.addEventListener('change', e => e)
// { oldValue, value } | { add } | { remove } | { pending } | { error }
// add, remove are items, pending bool, error error-object 
// only track value changes? use if ('value' in event)
// !!! bubbles:
root.addEventListener('changeIn', e => e.target.path) // also setIn, getIn
```

## Custom Subclass

```js
class MyItem extends Item {
    static ChildClass = MyItemChild  // child items creates MyItemChild-Instances
}
```

## Gotchas

```js
i.addEventListener('set', () => i.value = x)  // throws 'circular set'
// effects batch async — not synchronous
```


## Async I/O (reader / writer / io)

**The item tree is the cache — `io` is only transport.** *Which slice?* (depth, subtree, query)
is answered by the tree; *running / done / failed?* by `io`. An AsyncDataPoint has one value,
one getter, one setter — it cannot hold two slices of the same item.

A `writer` owns its **whole subtree**, so children are set `{local:true}` and never write
themselves. Writers are not inherited — setting a child without its own writer does no io and
returns `undefined`. REST/fs give every node a writer (`static ChildClass = Self`); whole-blob
sources (JSON column, cookie) use `AsyncChild`. See [doc/async.md](./doc/async.md).

```js
// quick-and-dirty async data point
i.reader = () => fetch('/api/value').then(r => r.json());
i.writer = v => fetch('/api/value', {method:'PUT', body: JSON.stringify(v)});

await i.read();   // triggers reader for the item (not recursive)
// primitive → sets value
// object → creates child items (keys only, values unfilled)
i.set(99);        // set locally + call writer;
await i.set(99);  // wait for server confirmation
await i.patch({a:3}); // like set, but with patch merge

// io: AsyncDataPoint instance (lazy, created on first access)
i.io.options.ttl = 10000;       // cache for 10s
i.io.options.optimistic = false;
i.io.options.debounceMs = 5;    // debounce period for setter in ms, default 5
i.io.setLocal(value); // set cached value without writing to master (use when value originates from master via other channel)

// Driver subclass pattern
class MyItem extends Item {
    reader() { return fetch('/api/'+this.key).then(r => r.json()); }
    writer(v) { return fetch('/api/'+this.key, {method:'PUT', body: JSON.stringify(v)}); }
    static ChildClass = false; // no children allowed
}
```

## Extensions

- **[Tools](./tools/README.md)** — HTTP Router, WebSocket, Change Tracking, JSON Sync, Schema Tools
- **[Adapters](./adapter/README.md)** — Filesystem (Deno), Cookies, Storage (localStorage/sessionStorage), HTTP Client, WebSocket Client


## Common Pitfalls

### Don't read object values directly
```js
const i = item({ a: 2 })
i.value.a         // ✗ — plain JS, not reactive
i.item('a').value // ✓ — reactive Item
```

### item() creates structure immediately (autovivification)
```js
i.item('a').item('x') // ✓ correct — but: 'a' becomes an object Item instantly,
                       //   even if you just wanted to check
i.has('a')?.item('x') // ✓ safe — only if 'a' already exists
```

### has() returns the Item, not a Boolean
```js
if (i.has('sub')) { }          // ✓ works (Item is truthy)
i.has('sub') === true          // ✗ always false
i.has('sub')?.value            // ✓ idiomatic
```
