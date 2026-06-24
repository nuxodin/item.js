import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { Sql, sql, render } from '../sql.js';

const sqlite = { quoteId: (n) => `"${n.replaceAll('"', '""')}"`, placeholder: () => '?' };
const pg = { quoteId: (n) => `"${n}"`, placeholder: (i) => '$' + i };

Deno.test('sql`` collects params and text', () => {
    const f = sql`WHERE id = ${5} AND name = ${'a'}`;
    assertEquals(f.parts, [
        { text: 'WHERE id = ' },
        { param: 5 },
        { text: ' AND name = ' },
        { param: 'a' },
    ]);
});

Deno.test('sql.id and sql.raw', () => {
    assertEquals(sql.id('col').parts, [{ id: 'col' }]);
    assertEquals(sql.raw('TRUE').parts, [{ text: 'TRUE' }]);
});

Deno.test('nested Sql composes, params stay bound', () => {
    const where = sql`id = ${1}`;
    const f = sql`SELECT * FROM ${sql.id('mail')} WHERE ${where}`;
    assertEquals(f.parts, [
        { text: 'SELECT * FROM ' },
        { id: 'mail' },
        { text: ' WHERE ' },
        { text: 'id = ' },
        { param: 1 },
    ]);
});

Deno.test('sql.join with default and custom separator', () => {
    const cols = sql.join([sql.id('a'), sql.id('b')]);
    assertEquals(cols.parts, [{ id: 'a' }, { text: ', ' }, { id: 'b' }]);

    const and = sql.join([sql`a = ${1}`, sql`b = ${2}`], ' AND ');
    assertEquals(and.parts, [
        { text: 'a = ' }, { param: 1 },
        { text: ' AND ' },
        { text: 'b = ' }, { param: 2 },
    ]);
});

Deno.test('empty template strings produce no text parts', () => {
    const f = sql`${42}`;
    assertEquals(f.parts, [{ param: 42 }]);
    assertEquals(new Sql().parts, []);
});

Deno.test('render: params bound, ids quoted (sqlite "?" placeholder)', () => {
    const f = sql`SELECT * FROM ${sql.id('mail')} WHERE id = ${5} AND name = ${'a'}`;
    assertEquals(render(f, sqlite), {
        text: 'SELECT * FROM "mail" WHERE id = ? AND name = ?',
        params: [5, 'a'],
    });
});

Deno.test('render: same AST, dialect-divergent placeholders (pg "$n")', () => {
    const f = sql`WHERE id = ${5} AND name = ${'a'}`;
    assertEquals(render(f, pg), { text: 'WHERE id = $1 AND name = $2', params: [5, 'a'] });
});

Deno.test('render: identifier quoting escapes', () => {
    assertEquals(render(sql.id('a"b'), sqlite).text, '"a""b"');
});
