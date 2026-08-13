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
