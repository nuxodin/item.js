import { describe, it, expect } from './bdd.js';

import { AsyncDataPoint } from '../../src/AsyncDataPoint.js';
import { bildJsonItem } from '../../tools/jsonDataItem.js';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

describe('AsyncDataPoint', () => {

    describe('write order', () => {
        it('a write that is running is not overtaken by the next one', async () => {
            let remote, running = 0, overlapped = false;
            const point = new AsyncDataPoint({
                get: async () => remote,
                // the first write is slow, the second fast: unordered, the first would land last
                set: async (value) => {
                    if (running++) overlapped = true;
                    await delay(value === 'old' ? 40 : 5);
                    remote = value;
                    running--;
                },
                debounceMs: 0,
            });
            point.set('old');
            await delay(10); // the first write is running now, no longer abortable by debounce
            await point.set('new');
            await delay(60);
            expect(overlapped).to.be.false;
            expect(remote).to.equal('new');
        });

        it('writes waiting behind a running one collapse into the newest', async () => {
            const written = [];
            const point = new AsyncDataPoint({
                get: async () => written.at(-1),
                set: async (value) => { await delay(20); written.push(value); },
                debounceMs: 0,
            });
            point.set(1);
            await delay(5);
            point.set(2);
            await point.set(3);
            await delay(50);
            expect(written).to.deep.equal([1, 3]);
        });

        it('a json item keeps the newest document when writes overlap', async () => {
            let remote = '{}', n = 0;
            // the first save is slow — as an UPDATE that happens to land late
            const data = bildJsonItem('{}', async (json) => { await delay(n++ ? 2 : 30); remote = json; }, { debounce: 0 }).proxy;
            data.core.lang('de');
            await delay(5);
            data.core.token('A');
            await delay(80);
            expect(remote).to.equal('{"core":{"lang":"de","token":"A"}}');
        });

        it('setting the loaded value back while a write runs is a change', async () => {
            let remote = 'A';
            const point = new AsyncDataPoint({ get: async () => remote, set: async (v) => { await delay(20); remote = v; }, debounceMs: 0 });
            await point.get();
            point.set('B');
            await delay(5); // B is being written
            await point.set('A');
            expect(remote).to.equal('A');
            expect(await point.get()).to.equal('A');
        });

        it('a write overtaken by a newer one settles as that one does', async () => {
            let remote;
            const point = new AsyncDataPoint({ get: async () => remote, set: async (v) => { await delay(5); remote = v; }, debounceMs: 5 });
            const first = point.set(1); // aborted while it waits
            point.set(2);
            await first; // resolves — no AbortError for whoever awaits it
            expect(remote).to.equal(2);

            const failing = new AsyncDataPoint({ get: async () => 0, set: async (v) => { if (v === 2) throw new Error('db down'); }, debounceMs: 5 });
            const older = failing.set(1);
            failing.set(2).catch(() => {});
            const error = await older.then(() => null, (e) => e);
            expect(error?.message).to.equal('db down'); // the newer write failed, so the older one did too
        });
    });

    describe('errors', () => {
        it('lastError reports a failed write until the next one', async () => {
            let fail = true;
            const point = new AsyncDataPoint({ get: async () => 0, set: async () => { if (fail) throw new Error('db down'); }, debounceMs: 0 });
            await point.set(1).catch(() => {});
            expect(point.lastError?.message).to.equal('db down');
            fail = false;
            await point.set(2);
            expect(point.lastError).to.be.undefined;
        });

        it('an onchange listener throwing on a failed write does not escape', async () => {
            const point = new AsyncDataPoint({ get: async () => 0, set: async () => { throw new Error('db down'); }, debounceMs: 0 });
            point.onchange = () => { throw new Error('listener bug'); };
            const log = console.error;
            console.error = () => {}; // the listener's error is logged, not thrown
            try {
                await point.set(1).catch(() => {});
                await delay(10); // an unhandled rejection would fail this test
            } finally {
                console.error = log;
            }
        });
    });
});
