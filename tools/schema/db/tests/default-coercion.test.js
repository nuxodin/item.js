// Cross-driver contract: how a JSON-Schema `default` is rendered into a column DEFAULT
// clause must be considered for every SQL dialect here. Most literals stay identical;
// booleans use the native representation of each dialect.
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { toFieldDef as mysql }  from '../mysql/to-field.js';
import { toFieldDef as pg }     from '../pg/to-field.js';
import { toFieldDef as sqlite } from '../sqlite/to-field.js';

const drivers = { mysql, pg, sqlite };

// Extract just the `DEFAULT …` token from a generated column definition (null if absent).
const defaultOf = (toFieldDef, prop) => toFieldDef('f', prop).match(/ DEFAULT (.+)$/)?.[1] ?? null;
const expectedFor = (expected, driver) => expected && typeof expected === 'object' ? expected[driver] : expected;

const cases = [
    ['boolean false',                { type: 'boolean', default: false },               { mysql: '0', sqlite: '0', pg: 'FALSE' }],
    ['boolean true',                 { type: 'boolean', default: true },                { mysql: '1', sqlite: '1', pg: 'TRUE' }],
    ['integer unquoted',             { type: 'integer', default: 5 },                   '5'],
    ['number unquoted',              { type: 'number',  default: 1.5 },                 '1.5'],
    ['string quoted',                { type: 'string', maxLength: 10, default: 'hi' },  "'hi'"],
    ['boolean on a string → empty',  { type: 'string', maxLength: 10, default: false }, "''"],
    ['no default → no clause',       { type: 'integer' },                               null],
];

for (const [name, toFieldDef] of Object.entries(drivers)) {
    for (const [desc, prop, expected] of cases) {
        Deno.test(`default coercion [${name}] ${desc}`, () => {
            assertEquals(defaultOf(toFieldDef, prop), expectedFor(expected, name));
        });
    }
}
