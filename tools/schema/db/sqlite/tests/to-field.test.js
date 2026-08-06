// Dialect-specific column rendering. The cross-driver DEFAULT contract lives in db/tests/.
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { toFieldDef } from '../to-field.js';
import { schemaFromField } from '../from-field.js';

Deno.test('sqlite toFieldDef: type mapping', () => {
    assertEquals(toFieldDef('f', { type: 'boolean' }), '`f` BOOLEAN');
    assertEquals(toFieldDef('f', { type: 'integer' }), '`f` INTEGER');
    assertEquals(toFieldDef('f', { type: 'number' }),  '`f` REAL');
    assertEquals(toFieldDef('f', { type: 'string', maxLength: 10 }), '`f` VARCHAR(10)');
    assertEquals(toFieldDef('f', { type: 'string' }),  '`f` TEXT');
    assertEquals(toFieldDef('f', { type: 'string', format: 'date-time' }), '`f` DATETIME');
});

// SQLite has no boolean type, only affinities — but the declared name is what schemaFromField
// reads back. Writing INTEGER here would return `integer` and leave a diff that never settles.
Deno.test('sqlite toFieldDef: the declared type survives a round trip', () => {
    for (const type of ['boolean', 'integer', 'number']) {
        const declared = toFieldDef('f', { type }).match(/` (.+)$/)[1];
        assertEquals(schemaFromField({ name: 'f', type: declared }).type, type, type);
    }
});
