import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { sql, render } from '../sql.js';
import { sqlite } from '../dialect/sqlite.js';
import { mysql } from '../dialect/mysql.js';
import { pg } from '../dialect/pg.js';

// Pure descriptor checks — no connection needed. A live round-trip lives in
// connect.sqlite.test.js; MySQL's needs a running server (host integration test).

Deno.test('sqlite descriptor: double-quote ids, "?" placeholder', () => {
    assertEquals(sqlite.quoteId('a"b'), '"a""b"');
    assertEquals(sqlite.placeholder(1), '?');
    assertEquals(sqlite.emptyInsert, 'DEFAULT VALUES');
});

Deno.test('mysql descriptor: backtick ids, "?" placeholder', () => {
    assertEquals(mysql.quoteId('a`b'), '`a``b`');
    assertEquals(mysql.placeholder(1), '?');
    assertEquals(mysql.emptyInsert, '() VALUES ()');
});

Deno.test('pg descriptor: double-quote ids, "$n" placeholders, RETURNING', () => {
    assertEquals(pg.quoteId('a"b'), '"a""b"');
    assertEquals(pg.placeholder(2), '$2');
    assertEquals(pg.emptyInsert, 'DEFAULT VALUES');
    const ins = sql`INSERT INTO ${sql.id('t')} (${sql.id('a')}) VALUES (${1})`;
    assertEquals(render(pg.appendReturning(ins, 'id'), pg), {
        text: 'INSERT INTO "t" ("a") VALUES ($1) RETURNING "id"', params: [1],
    });
});

Deno.test('same AST renders per dialect (id quoting + placeholder diverge, params identical)', () => {
    const frag = sql`SELECT * FROM ${sql.id('mail')} WHERE id = ${5}`;
    assertEquals(render(frag, sqlite), { text: 'SELECT * FROM "mail" WHERE id = ?', params: [5] });
    assertEquals(render(frag, mysql), { text: 'SELECT * FROM `mail` WHERE id = ?', params: [5] });
    assertEquals(render(frag, pg), { text: 'SELECT * FROM "mail" WHERE id = $1', params: [5] });
});
