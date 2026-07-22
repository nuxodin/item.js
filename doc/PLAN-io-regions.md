# Plan: io regions

Target model (worked out 2026-07, see doc/async.md "io regions"):
an item is served by its nearest ancestor-or-self with hooks (`ioOwner`); all items sharing
one owner form a region; the owner reads/writes the region as one value. Three orthogonal
bits, nothing else stored:

- **declaration** (static, on the owner): `readsFull = true` — "my reader delivers the whole region"
- **`loaded`** (dynamic, io): did the region value ever arrive (resolves via ioOwner)
- **TTL** (io.options): freshness

Derived: `full = declaration ∧ loaded`. Write intent decides the guard, not position:
`set` on the owner = licence-free full replace; child-set and `patch` = partial intent,
require `full`. Query reads bypass io (io is by definition the whole value), may set
`loaded`, never `full`.

## Steps

1. **Tests first** — permanent `deno test` suite (`tests/deno/`), replacing the throwaway
   scratchpad verification. Current semantics green; target semantics encoded as
   `ignore: true` tests so the direction is executable documentation. ✅ done
2. **Owner declaration `readsFull`** — ✅ done
   a. `read()` merges plain-object reader returns with `depth: Infinity` for declared owners,
   b. guard requires the declaration for partial writes (undeclared reader-region → throw),
   c. `patch` counts as partial intent (`owner !== this || options.patch`).
   Open edge: `patch` directly on an `AsyncChild` (it has a reader but no `readsFull`) —
   revisit when slimming AsyncChild in step 5.
3. **`remove()` symmetry** — ✅ done: no own remover → removal is a partial write of the
   surrounding region (same licence as set/patch, resolved via the parent's ioOwner).
4. **Query path** — ✅ done: `read(query)` calls the reader directly (bypasses io), merges
   with `patch` (a slice never strips unmentioned children) and never touches `loaded`.
5. **Cleanup** — ✅ switch dropped, `AsyncChild` declares `readsFull`; ✅ all mocha suites
   migrated to runtime-shared specs (`tests/spec/*.test.js` + `bdd.js` shim — browser via
   the `mocha.*.html` shells, deno via `deno task test`; no chai dependency anymore).
   Bonus: AsyncDataPoint ttl is now a lazy expiry stamp instead of a timer per cache entry
   (deterministic under `deno test`, no dangling timers).
   **Remaining:** user runs `deno publish` (0.6.0), then bump qino deps.ts `@0.5.24 → @0.6.0`.

## Open design gaps (found by coverage audit, verified by repro)

- **`add()` in a blob region persists nothing** — with an `adder` everything is correct
  (POST stored it, `local:true` is right). Without one — a JSON column cannot POST — the key
  is generated locally and the owner is never written, so the child vanishes on the next
  read, while the equivalent `item(key).set(value)` does write. Proposal: no adder + region
  owner → plain `set(value)`, through the normal licence/write path.
- **`AsyncChild` could probably be dropped entirely.** Its remaining job (a child writing its
  parent's whole value) is what regions do by themselves: `Row.readsFull = true` +
  `ChildClass = Item` instead of `ChildClass = AsyncChild` in `adapter/indexedDb.js` — its
  only user. What would be lost is the auto-read (core throws on an unloaded region,
  AsyncChild reads first). Either callers do `await region.read()`, or the convenience moves
  into the core as an owner option (`autoRead`). **Not verified against the real adapter** —
  the throwaway rebuild used for checking was itself broken, so this needs a real test first.

Done since: `readsFull` vs. an explicit shallow `{value, depth}` reader return now throws
(in the io getter, so the region stays unloaded and the error travels the normal channel).

## Parked: 6 pre-existing red browser tests

Marked `it.skip` (with a SKIP comment) during the migration — they also fail on the
pre-region lib, so they were silently red in the browser for a while. Each is an open
design decision, mostly "does a promise/reader object-value apply values deep or keys-only":
4× core `promise handling`/`events`, 1× core `reader result sets value correctly`,
1× effect `set({})` trigger. Decide, then fix code or test.

## Decided along the way

- `local:true` must never imply `loaded` — it neither means "from the source" (also used
  for deliberate local state) nor "complete" (query/depth-1 slices arrive local too).
- `loaded` lives in AsyncDataPoint (`#getter` fulfilled) — every full-value path funnels
  through `#cacheGetter`, so one line covers reader/setLocal/setFromPromise/landed write.
- No `ioMode` enum: full/keys/partial are derivations, not states.
- Region size is an adapter choice; the API (`set`/`patch`/child-set) expresses intent and
  must behave identically for owner-on-table / owner-on-row / owner-on-field.
- Batching child writes brought no real wins (AsyncDataPoint already debounces the actual
  io) and introduced an unhandled-rejection trap — rejected, keep writes direct.
