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

Deno.test('mysql toFieldDef: DECIMAL takes its scale from multipleOf, its digits from the bounds', () => {
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.01 }), '`f` DECIMAL(12,2) NULL'); // 10 digits before the point, as MySQL's own default
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.05 }), '`f` DECIMAL(12,2) NULL');
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.01, maximum: 9999.99 }), '`f` DECIMAL(6,2) NULL');
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.001, minimum: -50 }), '`f` DECIMAL(5,3) NULL');
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.01, maximum: 1e30 }), '`f` DECIMAL(33,2) NULL'); // past 1e21
    // MySQL's limits: 65 digits, 30 of them after the point
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 1e-40 }), '`f` DECIMAL(40,30) NULL');
    assertEquals(toFieldDef('f', { type: 'number', multipleOf: 0.01, maximum: 1e80 }), '`f` DECIMAL(65,2) NULL');
});
