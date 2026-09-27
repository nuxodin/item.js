// Dialect-specific column rendering. The cross-driver DEFAULT contract lives in db/tests/.
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { toFieldDef } from '../to-field.js';

Deno.test('mysql toFieldDef: type mapping', () => {
    assertEquals(toFieldDef('f', { type: 'boolean' }), '`f` TINYINT(1) NULL');
    assertEquals(toFieldDef('f', { type: 'number' }),  '`f` DOUBLE NULL');
    assertEquals(toFieldDef('f', { type: 'string', maxLength: 10 }), '`f` VARCHAR(10) NULL');
});

Deno.test('mysql toFieldDef: required → NOT NULL', () => {
    assertEquals(toFieldDef('f', { type: 'boolean' }, { required: true }), '`f` TINYINT(1) NOT NULL');
});

Deno.test('mysql toFieldDef: TEXT/BLOB/JSON drop DEFAULT (not round-trip-stable)', () => {
    assertEquals(toFieldDef('f', { type: 'string', default: '' }), '`f` TEXT NULL');
    assertEquals(toFieldDef('f', { type: 'object', default: {} }), '`f` JSON NULL');
    assertEquals(toFieldDef('f', { type: 'string', contentEncoding: 'base64', default: '' }), '`f` BLOB NULL');
    // VARCHAR still keeps its default
    assertEquals(toFieldDef('f', { type: 'string', maxLength: 10, default: 'x' }), "`f` VARCHAR(10) NULL DEFAULT 'x'");
});

Deno.test('mysql toFieldDef: integer primary key is NOT NULL AUTO_INCREMENT', () => {
    assertEquals(
        toFieldDef('id', { type: 'integer', 'x-index': 'primary', 'x-autoincrement': true }),
        '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT',
    );
});

Deno.test('mysql toFieldDef: x-vector', async () => {
    const { schemaFromField } = await import('../from-field.js');
    const vector = { type: 'array', items: { type: 'number' }, 'x-vector': true };
    assertEquals(toFieldDef('v', vector, { required: true }), '`v` VECTOR(1) NOT NULL');
    assertEquals(toFieldDef('v', { ...vector, 'x-vector': 768 }, { required: true }), '`v` VECTOR(768) NOT NULL');
    assertEquals(schemaFromField({ Type: 'vector(1024)', Key: 'MUL' }), { ...vector, 'x-index': true });
});
