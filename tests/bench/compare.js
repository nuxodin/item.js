// Compares item.js with other reactive tree / store libraries on the same data and operations.
//   deno run -A --no-config tests/bench/compare.js            all libraries, one process each
//   NODE_ENV=production deno run -A --no-config tests/bench/compare.js vue    a single one (prints JSON)
// NODE_ENV=production: without it Vue, MobX and others load their slower development builds.
// Every library runs in its own process, so one does not warm up or deopt the JIT for the next.
// Each adapter uses the library's idiomatic API; the checks below make sure all do the same work.

import { item, effect as itemEffect } from '../../item.js';

const ROWS = 1000; // rows of { id, name, tags: { a, b } } → 6000 nodes, plus a 5 deep branch
const data = () => {
    const rows = {};
    for (let i = 0; i < ROWS; i++) rows[i] = { id: i, name: 'n' + i, tags: { a: 1, b: 2 } };
    return { deep: { a: { b: { c: { d: { e: 1 } } } } }, rows };
};
const NODES = 1 + 1 + 5 + 1 + ROWS * 6; // root, deep, a..e, rows, rows

const tick = async () => { for (let i = 0; i < 5; i++) await null; }; // lets microtask-batched effects run

// adapter: create(data) → store, and the operations on it
const adapters = {
    async 'item.js'() {
        return {
            create: d => item(d),
            readAll: s => { let n = 0; for (const r of s.item('rows')) { r.item('id').value; r.item('name').value; r.item('tags').item('a').value; r.item('tags').item('b').value; n++; } return n; },
            readPath: s => s.sub('deep', 'a', 'b', 'c', 'd', 'e').value,
            held: s => { const e = s.sub('deep', 'a', 'b', 'c', 'd', 'e'); return { read: () => e.value, write: v => e.value = v }; },
            watch: (s, i, onRun) => itemEffect(() => { s.item('rows').item(i).item('name').value; onRun(); }),
            writeName: (s, i, v) => s.item('rows').item(i).item('name').value = v,
            add: (s, k, v) => s.item(k).value = v,
            remove: (s, k) => s.item(k).remove(),
            plain: s => s.get(),
            copies: true,
            flush: tick,
        };
    },
    async 'item.js proxy'() {
        return {
            create: d => item(d).proxy,
            readAll: p => { let n = 0; for (const row of p.rows) { row.id(); row.name(); row.tags.a(); row.tags.b(); n++; } return n; },
            readPath: p => p.deep.a.b.c.d.e(),
            held: p => { const d = p.deep.a.b.c.d; return { read: () => d.e(), write: v => d.e = v }; },
            watch: (p, i, onRun) => itemEffect(() => { p.rows[i].name(); onRun(); }),
            writeName: (p, i, v) => p.rows[i].name = v,
            add: (p, k, v) => p[k] = v,
            remove: (p, k) => delete p[k],
            plain: p => p(),
            copies: true,
            flush: tick,
        };
    },
    async 'plain object'() { // no reactivity: the floor for reads, writes and memory
        return {
            create: d => d,
            readAll: s => { let n = 0; for (const k in s.rows) { const r = s.rows[k]; r.id; r.name; r.tags.a; r.tags.b; n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e,
            held: s => { const d = s.deep.a.b.c.d; return { read: () => d.e, write: v => d.e = v }; },
            writeName: (s, i, v) => s.rows[i].name = v,
            add: (s, k, v) => s[k] = v,
            remove: (s, k) => delete s[k],
            plain: s => s,
            copies: false,
        };
    },
    async vue() {
        const { reactive, effect, stop, toRaw } = await import('npm:@vue/reactivity@3.5.45');
        return {
            create: d => reactive(d),
            readAll: s => { let n = 0; for (const k in s.rows) { const r = s.rows[k]; r.id; r.name; r.tags.a; r.tags.b; n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e,
            held: s => { const d = s.deep.a.b.c.d; return { read: () => d.e, write: v => d.e = v }; },
            watch: (s, i, onRun) => { const r = effect(() => { s.rows[i].name; onRun(); }); return () => stop(r); },
            writeName: (s, i, v) => s.rows[i].name = v,
            add: (s, k, v) => s[k] = v,
            remove: (s, k) => delete s[k],
            plain: s => toRaw(s),
            copies: false,
        };
    },
    async mobx() {
        const { observable, autorun, toJS, configure } = await import('npm:mobx@7.1.5');
        configure({ enforceActions: 'never' });
        return {
            create: d => observable(d),
            readAll: s => { let n = 0; for (const k in s.rows) { const r = s.rows[k]; r.id; r.name; r.tags.a; r.tags.b; n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e,
            held: s => { const d = s.deep.a.b.c.d; return { read: () => d.e, write: v => d.e = v }; },
            watch: (s, i, onRun) => autorun(() => { s.rows[i].name; onRun(); }),
            writeName: (s, i, v) => s.rows[i].name = v,
            add: (s, k, v) => s[k] = v,
            remove: (s, k) => delete s[k],
            plain: s => toJS(s),
            copies: true,
        };
    },
    async valtio() { // vanilla valtio has no auto-tracking effect: subscribeKey is the closest
        const { proxy, snapshot } = await import('npm:valtio@2.3.2/vanilla');
        const { subscribeKey } = await import('npm:valtio@2.3.2/vanilla/utils');
        return {
            create: d => proxy(d),
            readAll: s => { let n = 0; for (const k in s.rows) { const r = s.rows[k]; r.id; r.name; r.tags.a; r.tags.b; n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e,
            held: s => { const d = s.deep.a.b.c.d; return { read: () => d.e, write: v => d.e = v }; },
            watch: (s, i, onRun) => subscribeKey(s.rows[i], 'name', onRun), // runs on changes only, not at once
            writeName: (s, i, v) => s.rows[i].name = v,
            add: (s, k, v) => s[k] = v,
            remove: (s, k) => delete s[k],
            plain: s => snapshot(s),
            copies: true,
            flush: tick,
        };
    },
    async legend() {
        const { observable, observe } = await import('npm:@legendapp/state@3.0.0-beta.48');
        return {
            create: d => observable(d),
            readAll: s => { let n = 0; const rows = s.rows; for (const k in rows.peek()) { const r = rows[k]; r.id.get(); r.name.get(); r.tags.a.get(); r.tags.b.get(); n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e.get(),
            held: s => { const e = s.deep.a.b.c.d.e; return { read: () => e.get(), write: v => e.set(v) }; },
            watch: (s, i, onRun) => observe(() => { s.rows[i].name.get(); onRun(); }),
            writeName: (s, i, v) => s.rows[i].name.set(v),
            add: (s, k, v) => s[k].set(v),
            remove: (s, k) => s[k].delete(),
            plain: s => s.get(),
            copies: false,
        };
    },
    async solid() { // browser build via esm.sh: under Deno, npm: resolves to the non-reactive server build
        const { createRoot, createRenderEffect } = await import('https://esm.sh/solid-js@1.9.18?target=es2022');
        const { createStore, unwrap } = await import('https://esm.sh/solid-js@1.9.18/store?target=es2022');
        const setters = new WeakMap(); // store → its setter
        const set = (s, ...args) => setters.get(s)(...args);
        return {
            create: d => { const [s, set] = createStore(d); setters.set(s, set); return s; },
            readAll: s => { let n = 0; for (const k in s.rows) { const r = s.rows[k]; r.id; r.name; r.tags.a; r.tags.b; n++; } return n; },
            readPath: s => s.deep.a.b.c.d.e,
            held: s => { const d = s.deep.a.b.c.d; return { read: () => d.e, write: v => set(s, 'deep', 'a', 'b', 'c', 'd', 'e', v) }; },
            watch: (s, i, onRun) => createRoot(dispose => { createRenderEffect(() => { s.rows[i].name; onRun(); }); return dispose; }),
            writeName: (s, i, v) => set(s, 'rows', i, 'name', v),
            add: (s, k, v) => set(s, k, v),
            remove: (s, k) => set(s, k, undefined),
            plain: s => unwrap(s),
            copies: false,
        };
    },
};

// best time of several rounds, in ms per round
function best(fn, rounds = 15) {
    let min = Infinity;
    for (let r = 0; r < rounds; r++) { const t = performance.now(); fn(); min = Math.min(min, performance.now() - t); }
    return min;
}
async function bestAsync(fn, rounds = 15) {
    let min = Infinity;
    for (let r = 0; r < rounds; r++) min = Math.min(min, await fn());
    return min;
}
const perOp = (n, fn) => best(() => { for (let i = 0; i < n; i++) fn(i); }) * 1e6 / n; // ns per op
const assert = (ok, what) => { if (!ok) throw new Error('check failed: ' + what); };

async function run(name) {
    const lib = await adapters[name]();
    const flush = lib.flush ?? (() => {});
    const r = {};

    // create, and create + touch every leaf (lazy libraries do their work on first access)
    r.create = best(() => lib.create(data()));
    r.createRead = best(() => assert(lib.readAll(lib.create(data())) === ROWS, 'readAll'));
    const plainCost = best(() => data());
    r.create -= plainCost; r.createRead -= plainCost; // building the input object is not the library's work

    const s = lib.create(data());
    lib.readAll(s);
    assert(lib.readPath(s) === 1, 'readPath');
    r.readPath = perOp(1e6, () => lib.readPath(s));
    const held = lib.held(s);
    r.readHeld = perOp(1e6, held.read);
    r.writeHeld = perOp(2e5, i => held.write(i + 2));
    await flush();
    assert(held.read() === 2e5 + 1, 'writeHeld');

    // 1000 effects, one per row name; then change every name once and wait until all effects ran
    if (lib.watch) {
    let runs = 0;
    const onRun = () => runs++;
    r.watchSetup = await bestAsync(async () => {
        const t = performance.now();
        const disposers = [];
        for (let i = 0; i < ROWS; i++) disposers.push(lib.watch(s, i, onRun));
        const ms = performance.now() - t;
        for (const d of disposers) d();
        await flush();
        return ms;
    }, 5);
    const watchers = [];
    for (let i = 0; i < ROWS; i++) watchers.push(lib.watch(s, i, onRun));
    await flush();
    let round = 0;
    r.propagate = await bestAsync(async () => {
        round++;
        runs = 0;
        const t = performance.now();
        for (let i = 0; i < ROWS; i++) lib.writeName(s, i, 'r' + round + '_' + i);
        await flush();
        const ms = performance.now() - t;
        assert(runs === ROWS, `propagate: ${runs} effect runs instead of ${ROWS}`);
        return ms;
    }, 10);
    for (const d of watchers) d();
    await flush();
    }

    // add 1000 keys to the root, then remove them
    r.addRemove = best(() => {
        for (let i = 0; i < ROWS; i++) lib.add(s, 'k' + i, i);
        for (let i = 0; i < ROWS; i++) lib.remove(s, 'k' + i);
    });
    assert(!('k0' in lib.plain(s)), 'remove');

    let x = 0;
    r.plain = best(() => { held.write(++x); lib.plain(s); }); // after a change: no cached snapshot
    assert(lib.plain(s).rows[5].tags.b === 2, 'plain');
    r.copies = lib.copies;

    // memory per node after every leaf was read once
    if (globalThis.gc) {
        const keep = [];
        gc(); gc();
        const before = Deno.memoryUsage().heapUsed;
        for (let i = 0; i < 20; i++) { const x = lib.create(data()); lib.readAll(x); keep.push(x); }
        gc(); gc();
        r.bytes = (Deno.memoryUsage().heapUsed - before) / (20 * NODES);
        keep.length = 0;
    }
    return r;
}

const rows = [
    ['create', 'create 6000 nodes', 'ms'],
    ['createRead', 'create + read every leaf', 'ms'],
    ['readPath', 'read leaf, path from root (5 deep)', 'ns'],
    ['readHeld', 'read leaf, held handle', 'ns'],
    ['writeHeld', 'write leaf, held handle, no effect', 'ns'],
    ['watchSetup', 'create 1000 effects', 'ms'],
    ['propagate', '1000 writes → 1000 effects ran', 'ms'],
    ['addRemove', 'add + remove 1000 keys', 'ms'],
    ['plain', 'plain value of the tree', 'ms'],
    ['bytes', 'memory per node (after full read)', 'B'],
];

const only = Deno.args[0];
if (only) {
    console.log(JSON.stringify(await run(only)));
} else {
    const self = new URL(import.meta.url).pathname;
    const results = {};
    for (const name of Object.keys(adapters)) {
        const out = await new Deno.Command(Deno.execPath(), { args: ['run', '-A', '--no-config', '--v8-flags=--expose-gc', self, name], env: { NODE_ENV: 'production' }, stdout: 'piped', stderr: 'piped' }).output();
        const text = new TextDecoder().decode(out.stdout).trim().split('\n').pop();
        try { results[name] = JSON.parse(text); }
        catch { results[name] = null; console.error(name, 'failed:', new TextDecoder().decode(out.stderr).trim().split('\n').slice(-3).join(' ')); }
    }
    const names = Object.keys(results);
    const fmt = (v, unit) => v == null ? '–' : unit === 'ns' ? v.toFixed(0) : unit === 'B' ? v.toFixed(0) : v.toFixed(2);
    console.log(''.padEnd(38) + names.map(n => n.padStart(14)).join(''));
    for (const [key, label, unit] of rows) {
        console.log(`${label} [${unit}]`.padEnd(38) + names.map(n => fmt(results[n]?.[key], unit).padStart(14)).join(''));
    }
    console.log('plain value is a copy'.padEnd(38) + names.map(n => String(results[n]?.copies ?? '–').padStart(14)).join(''));
}
