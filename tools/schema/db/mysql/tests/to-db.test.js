// No live MySQL in tests: record the generated DDL against an empty database (SHOW TABLES → []),
// or against a table described by column fixtures — the only way to reach the "column exists" path.
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { schemaToDb } from '../to-db.js';

async function ddl(props, required = []) {
    const seen = [];
    const schema = { properties: { t: { additionalProperties: { properties: props, required } } } };
    await schemaToDb(schema, (sql) => { seen.push(sql); return Promise.resolve([]); }, { patch: true });
    return seen.join('\n');
}

/** Answers the three read queries from `columns`, records everything else as emitted DDL. */
function existing(columns) {
    const seen = [];
    const rows = columns.map(c => ({ Null: 'YES', Key: '', Default: null, Extra: '', Comment: '', ...c }));
    const indexes = rows.filter(r => r.Key).map(r => ({
        Key_name:     r.Key === 'PRI' ? 'PRIMARY' : r.Field,
        Seq_in_index: 1,
        Column_name:  r.Field,
        Non_unique:   r.Key === 'MUL' ? 1 : 0,
        Index_type:   'BTREE',
        Sub_part:     null,
    }));
    const query = (sql) => {
        if (sql === 'SHOW TABLES') return Promise.resolve([{ Tables_in_test: 't' }]);
        if (sql.startsWith('SHOW FULL FIELDS')) return Promise.resolve(rows);
        if (sql.startsWith('SHOW INDEX')) return Promise.resolve(indexes);
        seen.push(sql);
        return Promise.resolve([]);
    };
    return { query, seen };
}

async function migrate(columns, props, opts = {}) {
    const { query, seen } = existing(columns);
    const schema = { properties: { t: { additionalProperties: { properties: props, required: opts.required ?? [] } } } };
    await schemaToDb(schema, query, opts);
    return seen;
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

Deno.test('mysql schemaToDb: a narrower requirement fits the existing column', async () => {
    const seen = await migrate(
        [{ Field: 'name', Type: 'varchar(255)' }],
        { name: { type: 'string', maxLength: 191 } },
        { patch: true },
    );
    assertEquals(seen, []);   // widen only — never narrow, and never truncate
});

Deno.test('mysql schemaToDb: a wider requirement modifies the column', async () => {
    const seen = await migrate(
        [{ Field: 'name', Type: 'varchar(191)' }],
        { name: { type: 'string', maxLength: 255 } },
        { patch: true },
    );
    assertEquals(seen.length, 1);
    assertStringIncludes(seen[0], 'MODIFY COLUMN `name` VARCHAR(255)');
});

Deno.test('mysql schemaToDb: an existing integer column that already holds the range stays', async () => {
    const seen = await migrate(
        [{ Field: 'n', Type: 'int' }],
        { n: { type: 'integer', minimum: 0, maximum: 100 } },
        { patch: true },
    );
    assertEquals(seen, []);   // INT holds 0..100 — no narrowing to TINYINT UNSIGNED
});

Deno.test('mysql schemaToDb: what no DDL expresses never modifies a column', async () => {
    const seen = await migrate(
        [{ Field: 'name', Type: 'varchar(50)' }],
        { name: { type: 'string', maxLength: 50, pattern: '^\\w+$', description: 'a name' } },
        { patch: true },
    );
    assertEquals(seen, []);
});

Deno.test('mysql schemaToDb: a table matching its schema is left alone', async () => {
    // What MySQL reports for a table it created from this very schema — nothing may move.
    const columns = [
        { Field: 'id',     Type: 'int unsigned',  Null: 'NO', Key: 'PRI', Extra: 'auto_increment' },
        { Field: 'name',   Type: 'varchar(100)',  Null: 'NO', Key: 'MUL' },
        { Field: 'active', Type: 'tinyint(1)',    Default: '0' },
        { Field: 'kind',   Type: 'varchar(10)' },
        { Field: 'mail',   Type: 'varchar(190)' },
    ];
    const props = {
        id:     { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true },
        name:   { type: 'string', maxLength: 100, 'x-index': true, pattern: '^\\w+$' },
        active: { type: 'boolean', default: false },
        kind:   { type: 'string', maxLength: 10, enum: ['a', 'b'] },
        mail:   { type: 'string', maxLength: 190, format: 'email' },
    };
    for (const patch of [true, false]) {
        assertEquals(await migrate(columns, props, { patch, required: ['id', 'name'] }), [], `patch: ${patch}`);
    }
});
