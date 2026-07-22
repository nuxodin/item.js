import { describe, it, expect } from './bdd.js';

import { item } from '../../item.js';
import { AsyncChild } from '../../tools/AsyncChild.js';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

describe('reader', () => {
    it('read() fetches and sets value', async () => {
        const i = item();
        i.reader = () => Promise.resolve(42);
        await i.read();
        expect(i.value).to.equal(42);
    });

    it('read() returns Promise also when no reader set', () => {
        const i = item();
        expect(i.read()).to.be.a('Promise');
    });

    it('read() caches value (ttl)', async () => {
        let calls = 0;
        const i = item();
        i.reader = () => { calls++; return Promise.resolve(calls); };
        await i.read();
        await i.read();
        expect(calls).to.equal(1);
    });

    it('read() triggers change event', async () => {
        const i = item();
        i.reader = () => Promise.resolve('hello');
        const events = [];
        i.addEventListener('change', e => events.push(e));
        await i.read();
        await delay(0);
        expect(events.length).to.be.greaterThan(0);
        expect(events.some(e => e.value === 'hello')).to.be.true;
    });

    it('read() with object value creates child items', async () => {
        const i = item();
        i.reader = () => Promise.resolve({ a: 1, b: 2 });
        await i.read();
        expect(i.has('a')).to.be.ok;
        expect(i.has('b')).to.be.ok;
    });

    it('read() reader only reads 1. level if value is returned', async () => {
        const i = item();
        i.reader = () => {
            return Promise.resolve({ a: 1, b: 2 });
        }
        await i.read();
        expect(i.item('a').value).to.equal(undefined);
    });

    it('read() with undefined return does not set value', async () => {
        const i = item(99);
        i.reader = () => Promise.resolve(undefined);
        await i.read();
        expect(i.value).to.equal(99);
    });

    it('read(query) patches: updates mentioned keys, keeps unmentioned ones', async () => {
        const i = item();
        i.item('untouched').set('stays');
        i.item('mentioned').set('old');
        i.reader = () => Promise.resolve({ value: { mentioned: 'fresh', added: 'new' }, depth: true });
        await i.read({ filtered: true });
        expect(i.item('untouched').value).to.equal('stays');  // not in the slice → kept, not removed
        expect(i.item('mentioned').value).to.equal('fresh');  // in the slice → updated, not skipped
        expect(i.item('added').value).to.equal('new');
    });
});

describe('io options', () => {
    it('io is lazily created', () => {
        const i = item();
        i.reader = () => Promise.resolve(1);
        expect(i.io).to.be.an('object');
        expect(i.io).to.not.equal(null);
    });
    it('io.options.ttl can be changed', async () => {
        let calls = 0;
        const i = item();
        i.reader = () => { calls++; return Promise.resolve(calls); };
        i.io.options.ttl = 20;
        await i.read();
        await delay(30);
        await i.read();
        expect(calls).to.equal(2);
    });

    it('same io instance is reused', () => {
        const i = item();
        i.reader = () => Promise.resolve(1);
        expect(i.io).to.equal(i.io);
    });

    it('io.onchange fires exactly once per read()', async () => {
        const i = item();
        i.reader = () => Promise.resolve({ a: 1, b: 2 });
        let count = 0;
        i.io.onchange = ({value}) => {
            count++;
            if (value === undefined) return;
            i.$set(value, {patch: true});
        };
        await i.read();
        await delay(0);
        expect(count).to.equal(1);
    });

});

describe('writer via set()', () => {
    it('set() calls writer', async () => {
        let written = null;
        const i = item();
        i.reader = () => Promise.resolve(0);
        i.writer = v => { written = v; return Promise.resolve(v); };
        await i.set(99);
        await delay(10);
        expect(written).to.equal(99);
    });

    it('set() without writer does not throw', async () => {
        const i = item();
        i.reader = () => Promise.resolve(0);
        await i.read();
        expect(() => i.set(1)).to.not.throw();
    });

    // The return value answers exactly one question: is an io-write running, and when is it done?
    // Never *what* it resolves to — that is whatever the writer happened to return.
    it('set() returns the io-promise while a write runs', async () => {
        const i = item();
        i.writer = () => Promise.resolve();
        const ret = i.set(99);
        expect(ret).to.be.a('promise');
        await ret;
    });

    it('set() returns undefined when the value is unchanged – nothing is written', async () => {
        const i = item();
        i.writer = () => Promise.resolve();
        await i.set(99);
        expect(i.set(99)).to.equal(undefined);
    });

    it('set() returns undefined when a listener prevents the write', () => {
        const i = item();
        let writerCalled = false;
        i.writer = () => { writerCalled = true; return Promise.resolve(); };
        i.addEventListener('set', (e) => e.preventDefault());
        expect(i.set(99)).to.equal(undefined);
        expect(writerCalled).to.equal(false);
    });
});

// Writing a child of a blob-style source (only the root is addressable) means writing the
// WHOLE root value back. If the root was never read, the local tree holds only what was
// touched — writing that would erase everything else on the remote side.
//
// Guard: partial writes need `readsFull` (the owner's declaration that its reader delivers
// the whole region) plus `loaded` (an io statement — did the value arrive). `filled` cannot
// serve here: it describes the local tree, and merely navigating to a child sets it.
// The core is strict (throws before writing); AsyncChild reads first, then merges.
describe('write-through must not clobber unread remote data', () => {

    // remote holds data the local tree has never seen
    const setup = (readerFn) => {
        const state = { remote: { important: 'keep me', sub: { subsub: 1, other: 'keep me too' } } };
        const root = item();
        root.readsFull = true;
        root.reader = readerFn ?? (() => structuredClone(state.remote));
        root.writer = (v) => { state.remote = structuredClone(v); return Promise.resolve(); };
        return { state, root };
    };

    it('a reader-region without readsFull refuses partial writes even when loaded', async () => {
        const { state, root } = setup();
        root.readsFull = false;
        await root.read();
        expect(() => root.item('sub').set(4)).to.throw(/readsFull/);
        await delay(30);
        expect(state.remote.important).to.equal('keep me');
    });

    it('never-read tree: setting a deep child throws, remote stays intact', async () => {
        const { state, root } = setup();
        expect(() => root.item('sub').item('subsub').set(4)).to.throw(/not loaded/);
        await delay(30);
        expect(state.remote.important).to.equal('keep me');
        expect(state.remote.sub.other).to.equal('keep me too');
    });

    it('never-read tree via AsyncChild: reads first, then merges', async () => {
        const { state, root } = setup();
        root.ChildClass = AsyncChild;
        await root.item('sub').item('subsub').set(4);
        await delay(30);
        expect(state.remote.important).to.equal('keep me');
        expect(state.remote.sub.other).to.equal('keep me too');
        expect(state.remote.sub.subsub).to.equal(4);
    });

    it('failing reader: nothing is written and the caller is told', async () => {
        const { state, root } = setup(() => { throw new Error('reader down'); });
        let refused = false;
        try { await root.item('sub').set(4); } catch { refused = true; }
        await delay(30);
        expect(state.remote.important).to.equal('keep me'); // above all: no data loss
        expect(refused).to.equal(true);
    });

    it('loaded resolves via the region owner; local sets do not fake it', async () => {
        const { root } = setup();
        expect(root.item('sub').loaded).to.equal(false);
        root.set({ x: 1 }, { local: true });              // deliberate local state ≠ read
        expect(root.loaded).to.equal(false);
        await root.read();
        expect(root.loaded).to.equal(true);
        expect(root.item('sub').loaded).to.equal(true);   // child resolves to its owner
    });

    // The happy path: readsFull lets the plain-object reader merge deep, so after one
    // read() the whole region is in the tree and partial writes are safe.
    it('after a full-depth read, untouched keys survive the write', async () => {
        const { state, root } = setup();
        await root.read();
        await root.sub(['sub', 'subsub']).set(4);
        await delay(30);
        expect(state.remote.important).to.equal('keep me');
        expect(state.remote.sub.other).to.equal('keep me too');
        expect(state.remote.sub.subsub).to.equal(4);
    });
});

describe('AsyncChild pattern', () => {
    it('child reads from parent value', async () => {
        const i = item()
        i.ChildClass = AsyncChild;
        i.reader = function() { Promise.resolve({ x: 10, y: 20 }).then(v => this.$set(v, {patch: true, local: true})); };
        await i.item('x').read();
        expect(i.item('x').value).to.equal(10);
        expect(i.item('y').value).to.equal(20);
    });
    it('child writes to parent value', async () => {
        const i = item()
        i.ChildClass = AsyncChild;
        let data = {};
        i.writer = function(v) { data = v; return delay(0); };
        await i.item('x').set(99);
        expect(data.x).to.equal(99);
    });
});
