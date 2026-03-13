import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { Mysql } from '../Mysql.js';
import { PgDb } from '../PgDb.js';
import { Sqlite } from '../Sqlite.js';

Deno.test('sql adapters quote identifiers per dialect', () => {
    assertEquals(new Sqlite().quoteId('a"b'), '"a""b"');
    assertEquals(new PgDb().quoteId('a"b'), '"a""b"');
    assertEquals(new Mysql({}).item('demo').quoteId('a`b'), '`a``b`');
});