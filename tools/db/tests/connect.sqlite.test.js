import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { DatabaseSync } from 'node:sqlite';
import { connect } from '../connect.js';
import { sqlite } from '../dialect/sqlite.js';
import { sql } from '../sql.js';
import { schemaToDb } from '../../schema/db/sqlite/to-db.js';

// A host-provided runner — connection-aware, dialect-dumb. tools/db ships none.
function sqliteRunner(db) {
    return {
        query: (text, params = []) => Promise.resolve(db.prepare(text).all(...params)),
        exec: (text, params = []) => {
            const r = db.prepare(text).run(...params);
            return Promise.resolve({ insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) });
        },
        transaction: async (fn) => {
            db.exec('BEGIN');
            try { const v = await fn(); db.exec('COMMIT'); return v; }
            catch (e) { db.exec('ROLLBACK'); throw e; }
        },
    };
}

const mailSchema = {
    properties: { mail: { additionalProperties: { properties: {
        id:      { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
        subject: { type: 'string', maxLength: 200 },
    } } } },
};

async function fresh() {
    const db = new DatabaseSync(':memory:');
    await schemaToDb(mailSchema, (s) => Promise.resolve(db.prepare(s).all()), { patch: true });
    return connect(sqlite, sqliteRunner(db));
}

const insert = (subject) => sql`INSERT INTO ${sql.id('mail')} (${sql.id('subject')}) VALUES (${subject})`;

Deno.test('connect sqlite: insert returns insertId, select reads it back', async () => {
    const db = await fresh();
    const { insertId, affectedRows } = await db.exec(insert('Hello'));
    assertEquals(affectedRows, 1);
    assertEquals(insertId, 1);
    const row = await db.row(sql`SELECT * FROM ${sql.id('mail')} WHERE id = ${insertId}`);
    assertEquals(row.subject, 'Hello');
});

Deno.test('connect sqlite: update and delete report affectedRows', async () => {
    const db = await fresh();
    const { insertId } = await db.exec(insert('a'));
    const upd = await db.exec(sql`UPDATE ${sql.id('mail')} SET ${sql.id('subject')} = ${'b'} WHERE id = ${insertId}`);
    assertEquals(upd.affectedRows, 1);
    assertEquals((await db.row(sql`SELECT subject FROM ${sql.id('mail')} WHERE id = ${insertId}`)).subject, 'b');
    const del = await db.exec(sql`DELETE FROM ${sql.id('mail')} WHERE id = ${insertId}`);
    assertEquals(del.affectedRows, 1);
});

Deno.test('connect sqlite: columns delegates to schema introspection', async () => {
    const db = await fresh();
    const cols = await db.columns('mail');
    assertEquals(Object.keys(cols).sort(), ['id', 'subject']);
    assertEquals(cols.subject.type, 'string');
});

Deno.test('connect sqlite: transaction rolls back on throw', async () => {
    const db = await fresh();
    await assertRejects(() => db.transaction(async () => {
        await db.exec(insert('x'));
        throw new Error('boom');
    }));
    assertEquals((await db.query(sql`SELECT * FROM ${sql.id('mail')}`)).length, 0);
});
