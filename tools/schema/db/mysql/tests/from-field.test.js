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

Deno.test('mysql schemaFromField: DECIMAL reports scale and bounds, so it reads back as it is', () => {
    const dec = schemaFromField({ Field: 'f', Type: 'decimal(11,2)', Null: 'YES' });
    assertEquals([dec.multipleOf, dec.minimum, dec.maximum], [0.01, -999999999.99, 999999999.99]);
    assertEquals(toFieldDef('f', dec), '`f` DECIMAL(11,2) NULL');
    for (const type of ['decimal(65,2)', 'decimal(65,30)', 'decimal(3,3)', 'decimal(5,1)']) {
        assertEquals(toFieldDef('f', schemaFromField({ Field: 'f', Type: type, Null: 'YES' })), `\`f\` ${type.toUpperCase()} NULL`);
    }
    const same = (prop, curr) => fieldNeedsDdl(prop, curr, ['multipleOf']);
    assertEquals(same({ type: 'number', multipleOf: 0.01 }, dec), false); // declared without bounds: stays
    assertEquals(same({ type: 'number', multipleOf: 0.01, maximum: 1e12 }, dec), true); // wider → widens
    // a column made without its scale (the cents cut off) is made anew
    assertEquals(same({ type: 'number', multipleOf: 0.01 }, schemaFromField({ Field: 'f', Type: 'decimal(10,0)', Null: 'YES' })), true);
});
