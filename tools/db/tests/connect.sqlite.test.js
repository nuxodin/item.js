import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { sql } from '../sql.js';
import { mailCon } from './helpers.js';

const cols = {
    id:      { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
    subject: { type: 'string', maxLength: 200 },
};
const fresh = () => mailCon(cols);
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
    const c = await db.columns('mail');
    assertEquals(Object.keys(c).sort(), ['id', 'subject']);
    assertEquals(c.subject.type, 'string');
});

Deno.test('connect sqlite: transaction rolls back on throw', async () => {
    const db = await fresh();
    await assertRejects(() => db.transaction(async () => {
        await db.exec(insert('x'));
        throw new Error('boom');
    }));
    assertEquals((await db.query(sql`SELECT * FROM ${sql.id('mail')}`)).length, 0);
});
