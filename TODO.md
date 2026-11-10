# TODO

**Not approved yet.** These are findings and ideas, not decisions: nothing here is settled to
be implemented, and the proposed fixes are suggestions. Ask before working on a point.

Open points from the line-by-line review of the core (`item.js`, `src/`), as of 0.6.24.
Every point marked *reproduced* was confirmed with a small script; line numbers drift, the
function names are the anchor. Delete a point once it is done.

## 1. Silent data loss in io

- **A local change made while a write is running is lost when the write lands.** *reproduced*
  `r.item('a').set(2)` starts a write; `r.item('x').set(9, {local: true})` before it lands;
  afterwards `x` is gone. The landed write is applied back to the tree as a full replace
  (`#onReceiveData` → `set(value, {local: true})`, [item.js:266](item.js#L266), triggered by
  `setLocal` in [AsyncDataPoint.js:132](src/AsyncDataPoint.js#L132)).
- **`add()` in a writer region does not write.** *reproduced* Without an `adder` the value is
  set `{local: true}`, the region owner is never told ([item.js:162](item.js#L162)).
  Idea: `local` only if an `adder` already saved it.
- **`ttl` counts from the start of the request.** *reproduced* A reader slower than `ttl`
  starts a second request on the next `read()`, `pending` is `false` while it runs and
  `loaded` never becomes `true`, so partial writes into the region keep throwing
  ([AsyncDataPoint.js:85](src/AsyncDataPoint.js#L85)). Idea: set the expiry when the read settles.
- **Data shaped like the reader envelope is misread.** *reproduced* A reader returning the
  real data `{value: 5, depth: 2}` yields the value `5`: the envelope `{value, depth}` is
  detected by its looks ([item.js:269](item.js#L269), same check in the `io` getter).
  Idea: mark the envelope explicitly.

## 2. Effects

- **A reused effect function is dead after `dispose`.** *reproduced* `effect(fn)` after a
  dispose runs once and never again; the same happens to an inner function when the outer
  effect re-runs. Cause: the state lives on the user's function (`fn.disposed`, `fn.deps`,
  `fn.nested`, `fn.parent` in [signal.js](src/signal.js)). Idea: one state object per
  `effect()` call. Needs a decision: two tests pin the current behaviour
  ([effect.test.js:284](tests/spec/effect.test.js#L284), [:369](tests/spec/effect.test.js#L369)).
- **Navigation does not observe the parent.** *reproduced* An effect reading
  `r.item('a').value` (or `p.a` on the proxy) depends on `a` only. If `a` is removed and
  created again, the effect never sees the new `a`. `has('a')` observes the parent and works.
  Idea, undecided: `item()` registers the parent inside an effect (coarser re-runs).
- **Timing.** Effects run on `requestAnimationFrame` in the browser and on a microtask
  elsewhere ([signal.js:60](src/signal.js#L60)). Animation frames stop in hidden tabs, so
  effects that save or send stop there too. Direction agreed: make it optional, later.

## 3. Consistency

- **Regions: only `loaded` asks the owner.** `read()`, `pending` and `error` look at the item
  itself ([item.js:258](item.js#L258), [:297-300](item.js#L297-L300)). `child.read()` inside a
  region returns `false` without reading. *reproduced*
- **io options are shared depending on creation order.** A child takes over the parent's
  options object only if the parent's `io` already exists ([item.js:235](item.js#L235)).
  *reproduced*
- **`JSON.stringify(proxy)` adds a child `toJSON`** and returns `undefined`; the warning
  comes after the damage ([proxy.js:31](src/proxy.js#L31)). *reproduced* Idea: reserve
  `toJSON` like `then`.
- **`remove()` on the root returns a rejected promise** instead of throwing
  ([item.js:174](item.js#L174)). More general: `remove()` is `async` but changes the tree at
  once, while `set()` returns a promise only when io runs.
- **`Date`, `Map` and functions become `{}`.** *reproduced* `item(new Date()).value` is an
  empty object, because everything non-primitive is read with `Object.entries`.
- **A child named `length` survives a replace by an array.** `Object.hasOwn` in `$set`
  counts the array's own `length` ([item.js:121](item.js#L121)).
- **Docs differ from the code:**
  - `adder` may return the bare key according to [doc/async.md:182](doc/async.md#L182); the code needs `{key}`.
  - `item.promise` is write-only ([item.js:296](item.js#L296)); [doc/async.md:137](doc/async.md#L137) lists it as readable.
  - `p()` never returns a promise; [SKILL.md:78](SKILL.md#L78) says it does while pending.
  - `ttl: 0` means "forever".
  - README and SKILL say effects run after a microtask ([README.md:61](README.md#L61), [SKILL.md:69](SKILL.md#L69)).
  - SKILL says `remove()` on the root throws ([SKILL.md:52](SKILL.md#L52)).

## 4. Small things

- **`clear()` is a `dispose()`:** it also removes listeners and io ([item.js:127](item.js#L127)).
- **Unused:** `getDebugState()` and `recentValue` in
  [AsyncDataPoint.js](src/AsyncDataPoint.js#L99) (only the browser test page reads them).
- **Memory, about 20 of 190 bytes per node:** `ChildClass` as an instance field
  ([item.js:345](item.js#L345)) and the two circular guards `#isSetting` / `#isGetting`
  ([item.js:19-20](item.js#L19-L20)), which only matter while listeners exist.
- **Every write in a region builds and deep-compares the whole region value** before the
  debounce ([item.js:88](item.js#L88), [AsyncDataPoint.js:121](src/AsyncDataPoint.js#L121)).
  Idea: do both when the write is actually sent.
- **Unhandled rejections:** `remove()` is called without `await` in `$set`
  ([item.js:121](item.js#L121)) and in the proxy's `deleteProperty`; a failing `remover`
  rejects into nowhere.

## Decided, not open

- Arrays become objects; no `push` / `pop`.
- `has()` returns the item, `item()` creates structure, `toString()` of an object item is its key.
- Objects report their keys (`add` / `remove`), leaves report their values. Removing a subtree
  is one `remove` on the parent; the removed items' own effects are not woken
  ([effect.test.js:184](tests/spec/effect.test.js#L184)).
- `oldValue` is only ever a primitive; children are never serialized for it.
- `get` / `set` / `change` events are dispatched only once a listener for them exists in the tree.
