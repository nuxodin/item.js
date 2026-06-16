import { assertEquals, assertThrows } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { schemaToDb } from '../to-db.js';

const schema = (prop) => ({
    properties: {
        t: { additionalProperties: { properties: { id: { 'x-index': 'primary' }, name: prop } } },
    },
});

function fakeStore({ keyPath = 'id', autoIncrement = false, indexes = {} } = {}) {
    const calls = [], map = new Map(Object.entries(indexes));
    return {
        calls,
        keyPath,
        autoIncrement,
        indexNames: { contains: (name) => map.has(name), [Symbol.iterator]: () => map.keys() },
        index: (name) => map.get(name),
        deleteIndex: (name) => { calls.push(['delete', name]); map.delete(name); },
        createIndex: (name, path, opts) => { calls.push(['create', name, path, opts]); map.set(name, opts); },
    };
}

function fakeDb(store) {
    return {
        db: { objectStoreNames: { contains: (name) => name === 't', [Symbol.iterator]: function* () { yield 't' } } },
        tx: { objectStore: () => store },
    };
}

Deno.test('indexeddb schemaToDb: recreates index when unique changes', () => {
    const store = fakeStore({ indexes: { name: { unique: false } } });
    const { db, tx } = fakeDb(store);

    schemaToDb(schema({ 'x-index': 'unique' }), db, tx);

    assertEquals(store.calls, [
        ['delete', 'name'],
        ['create', 'name', 'name', { unique: true }],
    ]);
});

Deno.test('indexeddb schemaToDb: keyPath changes require manual migration', () => {
    const store = fakeStore({ keyPath: 'old_id' });
    const { db, tx } = fakeDb(store);

    assertThrows(
        () => schemaToDb(schema({ 'x-index': true }), db, tx),
        Error,
        'changing keyPath/autoIncrement requires a manual migration',
    );
});
