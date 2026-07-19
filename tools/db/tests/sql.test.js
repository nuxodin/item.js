import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { Sql, sql, render, isTemplate, resolveSql } from '../sql.js';

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

Deno.test('resolveSql: awaits promised params and ids in place', async () => {
    const f = sql`UPDATE t SET ${sql.id(Promise.resolve('col'))} = ${Promise.resolve('v')} WHERE id = ${1}`;
    await resolveSql(f);
    assertEquals(render(f, sqlite), { text: 'UPDATE t SET "col" = ? WHERE id = ?', params: ['v', 1] });
});

Deno.test('resolveSql: promise resolving to a Sql fragment composes', async () => {
    const f = sql`SELECT * FROM mail WHERE ${Promise.resolve(sql`id = ${5}`)}`;
    await resolveSql(f);
    assertEquals(render(f, sqlite), { text: 'SELECT * FROM mail WHERE id = ?', params: [5] });
});

Deno.test('render: object params with own toString bind as strings', () => {
    const node = { toString: () => '42' };
    assertEquals(render(sql`WHERE redirect = ${node}`, sqlite), {
        text: 'WHERE redirect = ?',
        params: ['42'],
    });
    const date = new Date(0), blob = new Uint8Array([1]);
    assertEquals(render(sql`${date} ${blob} ${null}`, sqlite).params, [date, blob, null]);
});

Deno.test('render: plain objects and arrays throw', () => {
    let err;
    try { render(sql`${{ a: 1 }}`, sqlite); } catch (e) { err = e; }
    assertEquals(err instanceof TypeError, true);
    try { render(sql`${[1, 2]}`, sqlite); } catch (e) { err = e; }
    assertEquals(err.message.includes('array'), true);
});

Deno.test('render: id coerced via toString', () => {
    assertEquals(render(sql.id({ toString: () => 'tbl' }), sqlite).text, '"tbl"');
});

Deno.test('isTemplate: tagged template yes, Sql fragment and plain values no', () => {
    const tag = (strings) => isTemplate(strings);
    assertEquals(tag`a${1}b`, true);
    assertEquals(isTemplate(sql`x`), false);
    assertEquals(isTemplate(['a', 'b']), false); // array without .raw
    assertEquals(isTemplate('plain'), false);
    assertEquals(isTemplate(undefined), false);
});
