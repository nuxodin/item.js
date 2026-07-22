// io regions: ownership, loaded, write guard — see doc/async.md and doc/PLAN-io-regions.md.
// Runnable: deno test tests/deno/
// Tests marked `ignore: true` encode the TARGET semantics of the next plan steps.

import { item, Item } from '../../item.js';
import { AsyncChild } from '../../tools/AsyncChild.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const sorted = (v) => v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
    : v;
const eq = (a, b, what = '') => { // key-order-insensitive deep equal
    if (JSON.stringify(sorted(a)) !== JSON.stringify(sorted(b))) throw new Error(`${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
};
// io debounce timers (5ms) outlive fast assertions; sanitizers would report them as leaks.
const io = { sanitizeOps: false, sanitizeResources: false };

// blob region: hooks on the root only, remote holds data the tree has never seen.
// readsFull declares "my reader delivers the whole region" — a plain object return
// then merges deep (no {value, depth:true} wrapper needed).
const blob = (readerFn) => {
    const state = { remote: { important: 'keep', sub: { subsub: 1, other: 'keep too' } } };
    const root = item();
    root.readsFull = true;
    root.reader = readerFn ?? (() => structuredClone(state.remote));
    root.writer = (v) => { state.remote = structuredClone(v); return Promise.resolve(); };
    return { state, root };
};

/* ── region resolution ─────────────────────────────────────────────────── */

Deno.test('ioOwner: self when it has hooks, else nearest ancestor, else null', () => {
    const root = item();
    root.writer = () => Promise.resolve();
    eq(root.ioOwner === root, true, 'owner with hooks is itself');
    eq(root.item('a').item('b').ioOwner === root, true, 'child resolves to root');

    const local = item();
    eq(local.item('a').ioOwner, null, 'no hooks anywhere → null');
});

Deno.test('ioOwner: a descendant with own hooks cuts a sub-region (nearest wins)', () => {
    const root = item();
    root.writer = () => Promise.resolve();
    const mid = root.item('mid');
    mid.reader = () => 1;
    eq(mid.ioOwner === mid, true, 'own hook wins');
    eq(mid.item('leaf').ioOwner === mid, true, 'grandchild resolves to mid, not root');
});

/* ── write-through behavior matrix ─────────────────────────────────────── */

Deno.test('own writer: set returns the io-promise and writes', io, async () => {
    const r = item(); const w = [];
    r.writer = (v) => { w.push(v); return Promise.resolve(); };
    const p = r.set(42);
    eq(p instanceof Promise, true, 'returns promise');
    await p;
    eq(w, [42], 'written');
});

Deno.test('blob region (writer-only): child set writes the whole region, no read needed', io, async () => {
    const r = item(); const w = [];
    r.writer = (v) => { w.push(structuredClone(v)); return Promise.resolve(); };
    r.set({ a: 1, b: 2 }, { local: true });
    const p = r.item('a').set(9);
    eq(p instanceof Promise, true, 'returns promise');
    await p;
    eq(w.at(-1), { a: 9, b: 2 }, 'whole region, one field changed');
});

Deno.test('deep child writes through to the region owner', io, async () => {
    const r = item(); const w = [];
    r.writer = (v) => { w.push(structuredClone(v)); return Promise.resolve(); };
    r.set({ a: { b: 1 } }, { local: true });
    await r.sub(['a', 'b']).set(9);
    eq(w.at(-1), { a: { b: 9 } }, 'grandchild write');
});

Deno.test('local:true never triggers io', io, async () => {
    const r = item(); let called = false;
    r.writer = () => { called = true; return Promise.resolve(); };
    r.set({ a: 1 }, { local: true });
    eq(r.item('a').set(5, { local: true }), undefined, 'returns undefined');
    await delay(20);
    eq(called, false, 'writer untouched');
});

Deno.test('a child with its own writer is its own region — the root does not write it', io, async () => {
    const r = item(); const rw = [];
    r.writer = (v) => { rw.push(v); return Promise.resolve(); };
    r.set({ a: 1 }, { local: true });
    const c = r.item('a'); const cw = [];
    c.writer = (v) => { cw.push(v); return Promise.resolve(); };
    await c.set(5);
    eq(cw, [5], 'child wrote itself');
    eq(rw, [], 'root not involved');
});

Deno.test('plain local tree: child set does no io and returns undefined', () => {
    const r = item();
    r.set({ a: 1 }, { local: true });
    eq(r.item('a').set(5), undefined, 'no io');
    eq(r.item('a').peek(), 5, 'value set locally');
});

/* ── loaded & the clobber guard ────────────────────────────────────────── */

Deno.test('never-read region: partial write throws before anything is written', io, async () => {
    const { state, root } = blob();
    let msg = '';
    try { root.item('sub').item('subsub').set(4); } catch (e) { msg = e.message; }
    await delay(30);
    eq(/not loaded/.test(msg), true, "clear error");
    eq(state.remote.important, 'keep', 'remote intact');
});

Deno.test('failing reader: write refused, no data loss', io, async () => {
    const { state, root } = blob(() => { throw new Error('reader down'); });
    let refused = false;
    try { await root.item('sub').set(4); } catch { refused = true; }
    await delay(30);
    eq(refused, true, 'caller told');
    eq(state.remote.important, 'keep', 'remote intact');
});

Deno.test('after a full read, partial writes merge instead of clobbering', io, async () => {
    const { state, root } = blob();
    await root.read();
    await root.sub(['sub', 'subsub']).set(4);
    await delay(30);
    eq(state.remote, { important: 'keep', sub: { subsub: 4, other: 'keep too' } }, 'merged');
});

Deno.test('loaded: io truth, resolves via the owner, not faked by local sets or navigation', io, async () => {
    const { root } = blob();
    root.item('nav');                       // navigation fills the tree …
    eq(root.filled, true, 'filled by navigation');
    eq(root.loaded, false, '… but loaded stays an io question');
    root.set({ x: 1 }, { local: true });    // deliberate local state ≠ read
    eq(root.loaded, false, 'local set does not fake it');
    await root.read();
    eq(root.loaded, true, 'after read');
    eq(root.item('sub').loaded, true, 'child resolves to its owner');
});

Deno.test('loaded expires with the ttl — a stale region demands a fresh read', io, async () => {
    const { root } = blob();
    root.io.options = { ...root.io.options, ttl: 30 };
    await root.read();
    eq(root.loaded, true, 'fresh');
    await delay(60);
    eq(root.loaded, false, 'stale after ttl');
    let msg = '';
    try { root.item('sub').set(4); } catch (e) { msg = e.message; }
    eq(/not loaded/.test(msg), true, "guard forces a re-read");
    await root.read();
    eq(root.loaded, true, 'read refreshes');
});

Deno.test('AsyncChild: reads first, merges, whole region — also on unread trees and deep paths', io, async () => {
    const { state, root } = blob();
    root.ChildClass = AsyncChild;
    await root.item('sub').item('subsub').set(4);
    await delay(30);
    eq(state.remote, { important: 'keep', sub: { subsub: 4, other: 'keep too' } }, 'merge on unread tree');
});

Deno.test('a writer rejection reaches the awaiting caller', io, async () => {
    const r = item();
    r.writer = () => Promise.reject(new Error('disk full'));
    r.set({ a: 1 }, { local: true });
    let msg = '';
    try { await r.item('a').set(9); } catch (e) { msg = e.message; }
    eq(msg, 'disk full', 'rejection propagates through the region write');
});

Deno.test('reader-only region: child set stays local, no io, undefined', io, async () => {
    const r = item();
    r.reader = () => ({ a: 1 });
    await r.read();
    eq(r.item('a').set(9), undefined, 'nothing to write to');
    eq(r.item('a').peek(), 9, 'value kept locally');
});

Deno.test('fire-and-forget writes never become unhandled rejections', io, async () => {
    let unhandled = 0;
    const onUnhandled = (e) => { unhandled++; e.preventDefault(); };
    addEventListener('unhandledrejection', onUnhandled);
    try {
        const r = item();
        r.writer = () => Promise.resolve();
        r.set({ a: 1 }, { local: true });
        for (let i = 0; i < 10; i++) { r.item('a').set(i); await delay(0); }
        await delay(50);
    } finally {
        removeEventListener('unhandledrejection', onUnhandled);
    }
    eq(unhandled, 0, 'no unhandled rejections');
});

/* ── same API, three owner placements (spec from the users-table example) ── */

Deno.test('owner placement is an adapter choice — child set behaves identically', io, async () => {
    // row-owner (REST /users/3 style) — a row reads itself completely, so it declares it
    const row = item(); const rowWrites = [];
    row.readsFull = true;
    row.reader = () => ({ firstname: 'Ann', lastname: 'Lee' });
    row.writer = (v) => { rowWrites.push(structuredClone(v)); return Promise.resolve(); };
    await row.read();
    await row.item('firstname').set('Bob');
    eq(rowWrites.at(-1), { firstname: 'Bob', lastname: 'Lee' }, 'row-owner: rest preserved');

    // field-owner (atomic KV style)
    class FieldItem extends Item {
        writer(v) { (this.root.kv ??= {})[this.path.join('.')] = v; return Promise.resolve(); }
        static ChildClass = FieldItem;
    }
    const user = new FieldItem();
    await user.item('firstname').set('Bob');
    eq(user.kv, { firstname: 'Bob' }, 'field-owner: atomic, nothing else touched');
});

/* ── TARGET semantics (plan steps 2–4) — executable documentation ──────── */

Deno.test('readsFull: a plain-object reader merges deep — values, not just keys', io, async () => {
    const { root } = blob();
    await root.read();
    eq(root.sub(['sub', 'subsub']).peek(), 1, 'deep value arrived without {value,depth} wrapper');
});

Deno.test('without readsFull, even a loaded reader-region refuses partial writes', io, async () => {
    // completeness of the tree is unknowable without the declaration (depth-1 readers)
    const state = { remote: { important: 'keep', sub: { a: 1 } } };
    const root = item();
    root.reader = () => ({ value: structuredClone(state.remote), depth: true });
    root.writer = (v) => { state.remote = structuredClone(v); return Promise.resolve(); };
    await root.read();
    let msg = '';
    try { root.item('sub').set(4); } catch (e) { msg = e.message; }
    await delay(30);
    eq(/readsFull/.test(msg), true, 'refused with a pointer to the declaration');
    eq(state.remote.important, 'keep', 'remote intact');
});

Deno.test('patch is partial intent — an unread owner refuses it like a child set', io, async () => {
    const { state, root } = blob();
    let threw = false;
    try { await root.patch({ x: 1 }); } catch { threw = true; }    // never read!
    eq(threw, true, 'patch on unread owner refused');
    eq(state.remote.important, 'keep', 'remote intact');
    await root.read();                                             // after reading it flows
    await root.patch({ x: 1 });
    await delay(30);
    eq(state.remote, { important: 'keep', sub: { subsub: 1, other: 'keep too' }, x: 1 }, 'patch merges');
});

Deno.test('removing a child of a blob region writes the owner', io, async () => {
    const { state, root } = blob();
    await root.read();
    await root.item('sub').remove();
    await delay(30);
    eq(state.remote, { important: 'keep' }, 'key gone at the source, rest intact');
});

Deno.test('removing from an unread region throws before anything is deleted', io, async () => {
    const { state, root } = blob();
    let msg = '';
    try { await root.item('sub').remove(); } catch (e) { msg = e.message; }
    await delay(30);
    eq(/not loaded/.test(msg), true, "refused");
    eq(state.remote.sub.subsub, 1, 'remote intact');
});

Deno.test('remove in a writer-only region writes without a read; local remove stays local', io, async () => {
    const r = item(); const w = [];
    r.writer = (v) => { w.push(structuredClone(v)); return Promise.resolve(); };
    r.set({ a: 1, b: 2 }, { local: true });
    await r.item('a').remove();
    await delay(30);
    eq(w.at(-1), { b: 2 }, 'region written');
    await r.item('b').remove({ local: true });
    await delay(30);
    eq(w.at(-1), { b: 2 }, 'local remove: no further write');
});

Deno.test('an own remover wins over the region write', io, async () => {
    const { state, root } = blob();
    await root.read();
    let removerCalled = false;
    const sub = root.item('sub');
    sub.remover = () => { removerCalled = true; return Promise.resolve(); };
    const writesBefore = JSON.stringify(state.remote);
    await sub.remove();
    await delay(30);
    eq(removerCalled, true, 'remover called');
    eq(JSON.stringify(state.remote), writesBefore, 'owner not written — the remover owns the removal');
});

Deno.test('read(query) merges a slice past io — patches the tree, never touches loaded', io, async () => {
    const rows = { 1: { name: 'a' }, 2: { name: 'b' } };
    const table = item();
    table.writer = () => Promise.resolve();
    table.reader = (query) => query
        ? { value: { 1: structuredClone(rows[1]) }, depth: true }   // filtered slice
        : { value: structuredClone(rows), depth: true };            // full read

    await table.read({ limit: 1 });
    eq(table.keys, ['1'], 'slice merged into the tree');
    eq(table.sub(['1', 'name']).peek(), 'a', 'slice values arrived');
    eq(table.loaded, false, 'a slice never marks loaded');

    await table.read();                                             // full read via io
    eq(table.keys, ['1', '2'], 'full read completes the tree');
    eq(table.loaded, true, 'full read marks loaded');

    await table.read({ limit: 1 });                                 // slice AFTER full read
    eq(table.keys, ['1', '2'], 'a slice patches — it never strips unmentioned children');
    eq(table.loaded, true, 'and does not downgrade loaded');

    // and it never licenses a whole-region write: the table declares no readsFull
    let msg = '';
    try { table.item('1').item('name').set('x'); } catch (e) { msg = e.message; }
    eq(/readsFull/.test(msg), true, 'partial write still refused');
});
