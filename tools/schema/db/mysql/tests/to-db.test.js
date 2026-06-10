// No live MySQL in tests: record the generated DDL against an empty database (SHOW TABLES → []).
import { assertStringIncludes } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { schemaToDb } from '../to-db.js';

async function ddl(props, required = []) {
    const seen = [];
    const schema = { properties: { t: { additionalProperties: { properties: props, required } } } };
    await schemaToDb(schema, (sql) => { seen.push(sql); return Promise.resolve([]); }, { patch: true });
    return seen.join('\n');
}

Deno.test('mysql schemaToDb: AUTO_INCREMENT inline + separate PRIMARY KEY constraint', async () => {
    const sql = await ddl({ id: { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true } }, ['id']);
    assertStringIncludes(sql, '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT');
    assertStringIncludes(sql, 'PRIMARY KEY (`id`)');
});

Deno.test('mysql schemaToDb: composite primary key in one constraint', async () => {
    const sql = await ddl({
        a: { type: 'integer', 'x-index': 'primary' },
        b: { type: 'integer', 'x-index': 'primary' },
    });
    assertStringIncludes(sql, 'PRIMARY KEY (`a`, `b`)');
});
