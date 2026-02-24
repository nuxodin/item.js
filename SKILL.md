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

i.value
i.value = 99
i.get()           // = i.value, registers effect dependency
i.set(99)
i.patch({ a: 2 }) // merge, keeps unmentioned keys
i.filled          // false until first set

// set replaces, patch merges:
i = item({ a: 1, b: 2 })
i.value = { b: 3 }   // → { b: 3 }       'a' deleted
i.patch({ b: 3 })    // → { a: 1, b: 3 } 'a' kept (deep)

// equality: Object.is
i = item(NaN); i.value = NaN  // no change event
i = item(0);   i.value = -0   // change fires

// primitives → value !== Object(value)
// objects → nested child items

i.item('key')     // get/create child Item, fires change on parent
i.has('key');     // subitem / undefined
i.has('key')?.remove();
i.keys            // string[], registers effect dep
i.items()         // Item[]
b = i.sub('a', 'b')   // i.item('a').item('b'), accepts array/spread/mixed
b.key             // 'b' (undefined for root)
b.parent          // a (undefined for root)
b.path            // ['a','b'] ([] for root)
b.remove()        // fires change on parent, root throws

for (const child of i) { }

JSON.stringify(i) // → i.get()
`${i}`            // primitive: String(value ?? ''); object: key or ''
+i                // primitive: Number(value); object: NaN

// promise state
i.promise = fetch('/api').then(r => r.json())
i.pending
i.error           // Error | undefined
i.promise         // pending → Promise, resolved → Promise.resolve(i.get())
// new assignment cancels previous (race-safe)
// resolve → only changed keys fire change; reject → sets i.error, value unchanged

// async streaming children
i.loadItems = async function() {
    for (const key of await fetchKeys()) this.item(key)
}
for await (const child of i) { }
// yields existing, then new children as loadItems() adds them
```

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
'p:' + p         // 'p:42' / null 'p:null'
`p:${p}`         // 'p:42' / null 'p:'
++p;             // 43
p(1, 2)          // throws
p.xyz            // child proxy (auto-created)
p.xyz = v
delete p.xyz
'xyz' in p
Object.keys(p)
{ ...p }                 // { xyz: Proxy, ... }
Object.assign(p, src)    // sets each key on underlying items
p[$item]                 // underlying Item
for (const c of p) { }   // child proxies
for await (const c of p) { } // calls loadItems
JSON.stringify(p())      // ✓
JSON.stringify(p)        // ✗ logs warning
await p()                // ✓
await p                  // ✗ logs warning

// __proto__, constructor, prototype → safe, stored as normal data keys
```

## Events

```js
// fire on item
i.addEventListener('get',    e => e.detail) // { item, value }
i.addEventListener('set',    e => e.detail) // { item, oldValue, value, options } — preventable
i.addEventListener('change', e => e.detail)
// { item, oldValue, value } | { item, add } | { item, remove } | { item, pending } | { item, error }
// item, add, remove are items, pending bool, error error-object 
// only track value changes? use if ('value' in detail)
// bubbles:
root.addEventListener('changeIn', e => e.detail.item.path) // also setIn, getIn
```

## Custom Subclass

```js
class MyItem extends Item {
    static ChildClass = MyItemChild  // child items creates MyItemChild-Instances
}
```

## Gotchas

```js
i.addEventListener('get', () => i.value)      // throws 'circular get'
i.addEventListener('set', () => i.value = x)  // throws 'circular set'
// effects batch async — not synchronous
```