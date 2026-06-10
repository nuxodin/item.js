// Dialect-specific column rendering. The cross-driver DEFAULT contract lives in db/tests/.
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { toFieldDef } from '../to-field.js';

Deno.test('sqlite toFieldDef: type mapping (no boolean / nullability in SQLite)', () => {
    assertEquals(toFieldDef('f', { type: 'boolean' }), '`f` INTEGER');
    assertEquals(toFieldDef('f', { type: 'integer' }), '`f` INTEGER');
    assertEquals(toFieldDef('f', { type: 'number' }),  '`f` REAL');
    assertEquals(toFieldDef('f', { type: 'string', maxLength: 10 }), '`f` VARCHAR(10)');
    assertEquals(toFieldDef('f', { type: 'string' }),  '`f` TEXT');
});
