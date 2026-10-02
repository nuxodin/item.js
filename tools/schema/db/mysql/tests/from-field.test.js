import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { schemaFromField } from '../from-field.js';
import { toFieldDef } from '../to-field.js';
import { fieldNeedsDdl } from '../../shared/needs-ddl.js';

Deno.test('mysql schemaFromField: TEXT reports its bound, so a wider declaration widens it', () => {
    const text = schemaFromField({ Field: 'f', Type: 'text', Null: 'YES' });
    assertEquals(text.maxLength, 16383);
    assertEquals(toFieldDef('f', text), '`f` TEXT NULL'); // reads back as it is
    assertEquals(fieldNeedsDdl({ type: 'string', maxLength: 1073741823 }, text), true); // → LONGTEXT
    assertEquals(fieldNeedsDdl({ type: 'string' }, text), false); // undeclared: stays TEXT
});
