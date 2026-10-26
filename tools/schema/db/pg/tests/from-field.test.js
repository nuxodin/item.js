import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { schemaFromField } from '../from-field.js';

Deno.test('pg schemaFromField: identity primary key', () => {
    assertEquals(schemaFromField({
        udt_name: 'int4',
        is_identity: 'YES',
        is_primary: true,
    }), {
        type: 'integer',
        'x-index': 'primary',
        'x-autoincrement': true,
    });
});

Deno.test('pg schemaFromField: varchar unique with default and comment', () => {
    assertEquals(schemaFromField({
        udt_name: 'varchar',
        character_maximum_length: 20,
        column_default: "'hi'::character varying",
        comment: 'Greeting',
        is_unique: true,
    }), {
        type: 'string',
        maxLength: 20,
        default: 'hi',
        '$comment': 'Greeting',
        'x-index': 'unique',
    });
});

Deno.test('pg schemaFromField: timestamp is date-time', () => {
    assertEquals(schemaFromField({ udt_name: 'timestamp' }), { type: 'string', format: 'date-time' });
});

Deno.test('pg schemaFromField: NUMERIC(p,s) reports its step and bounds, an unbounded one neither', async () => {
    const { toFieldDef } = await import('../to-field.js');
    const { fieldNeedsDdl } = await import('../../shared/needs-ddl.js');
    const dec = schemaFromField({ udt_name: 'numeric', numeric_precision: 11, numeric_scale: 2, is_nullable: 'YES' });
    assertEquals([dec.multipleOf, dec.minimum, dec.maximum], [0.01, -999999999.99, 999999999.99]);
    assertEquals(toFieldDef('f', dec), '"f" NUMERIC(11,2) NULL'); // reads back as it is
    const same = (prop, curr) => fieldNeedsDdl(prop, curr, ['multipleOf']);
    assertEquals(same({ type: 'number', multipleOf: 0.01 }, dec), false); // a second start changes nothing
    // an unbounded NUMERIC (made by an earlier version) is given its step once
    assertEquals(same({ type: 'number', multipleOf: 0.01 }, schemaFromField({ udt_name: 'numeric', is_nullable: 'YES' })), true);
});
