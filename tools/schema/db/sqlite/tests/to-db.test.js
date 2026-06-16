import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { DatabaseSync } from 'node:sqlite';
import { schemaToDb } from '../to-db.js';

// Run the generated DDL against a real in-memory SQLite — proves it is both valid and correct.
function fresh() {
    const db = new DatabaseSync(':memory:');
    return { db, query: (sql) => Promise.resolve(db.prepare(sql).all()) };
}
const table = (props) => ({ properties: { t: { additionalProperties: { properties: props } } } });

Deno.test('sqlite schemaToDb: single integer PK is inline AUTOINCREMENT and assigns rowids', async () => {
    const { db, query } = fresh();
    await schemaToDb(table({
        id:   { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
        name: { type: 'string', maxLength: 100 },
    }), query, { patch: true });

    const id = db.prepare('PRAGMA table_info(`t`)').all().find((c) => c.name === 'id');
    assertEquals(id.pk, 1);
    assertEquals(id.type, 'INTEGER');
    const r = db.prepare('INSERT INTO `t` (name) VALUES (?)').run('x');
    assertEquals(Number(r.lastInsertRowid), 1);
});

Deno.test('sqlite schemaToDb: composite PK uses a table-level constraint', async () => {
    const { db, query } = fresh();
    await schemaToDb(table({
        a: { type: 'integer', 'x-index': 'primary' },
        b: { type: 'integer', 'x-index': 'primary' },
    }), query, { patch: true });

    const pks = db.prepare('PRAGMA table_info(`t`)').all().filter((c) => c.pk > 0);
    assertEquals(pks.length, 2);
});

Deno.test('sqlite schemaToDb: re-running the same schema is a no-op (idempotent)', async () => {
    const { query } = fresh();
    const schema = table({
        id:     { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
        name:   { type: 'string', maxLength: 100, 'x-index': true },
        active: { type: 'boolean', default: false },
    });
    await schemaToDb(schema, query, { patch: true });          // creates the table + index
    const again = await schemaToDb(schema, query, { patch: true });
    assertEquals(again.executed, []);                          // second run must emit no DDL
});

Deno.test('sqlite schemaToDb: type change in force mode recreates the table, data survives', async () => {
    const { db, query } = fresh();
    const v1 = table({ id: { type: 'integer', 'x-index': 'primary' }, n: { type: 'integer' } });
    await schemaToDb(v1, query, { patch: true });
    db.prepare('INSERT INTO `t` (id, n) VALUES (1, 5)').run();

    const v2 = table({ id: { type: 'integer', 'x-index': 'primary' }, n: { type: 'string', maxLength: 10 } });
    const res = await schemaToDb(v2, query, { force: true });
    assertEquals(res.executed.some((s) => s.includes('_migration_tmp')), true);
    assertEquals(db.prepare('PRAGMA table_info(`t`)').all().find((c) => c.name === 'n').type, 'VARCHAR(10)');
    assertEquals(String(db.prepare('SELECT n FROM `t` WHERE id = 1').get().n), '5');
});

Deno.test('sqlite schemaToDb: boolean default is stored as integer 0', async () => {
    const { db, query } = fresh();
    await schemaToDb(table({
        id:        { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
        superuser: { type: 'boolean', default: false },
    }), query, { patch: true });

    db.prepare('INSERT INTO `t` (id) VALUES (NULL)').run();
    const row = db.prepare('SELECT superuser, typeof(superuser) AS ty FROM `t`').get();
    assertEquals(row.superuser, 0);
    assertEquals(row.ty, 'integer');
});

Deno.test('sqlite schemaToDb: ignores sqlite internal tables', async () => {
    const { db, query } = fresh();
    const schema = table({ id: { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true } });
    await schemaToDb(schema, query, { patch: true });
    db.prepare('INSERT INTO `t` DEFAULT VALUES').run();

    const res = await schemaToDb(schema, query, { force: true });
    assertEquals(res.executed.some((s) => s.includes('sqlite_sequence')), false);
});

Deno.test('sqlite schemaToDb: recreate with no shared columns emits no empty insert', async () => {
    const { query } = fresh();
    await schemaToDb(table({ old: { type: 'string' } }), query, { patch: true });

    const res = await schemaToDb(table({ next: { type: 'string' } }), query, { force: true });
    assertEquals(res.executed.some((s) => s.includes('() SELECT')), false);
});
