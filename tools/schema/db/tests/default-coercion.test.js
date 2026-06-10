// Cross-driver contract: how a JSON-Schema `default` is rendered into a column DEFAULT
// clause must be IDENTICAL across all SQL dialects. Adding a driver or a case here forces
// it to be considered for every driver — that's the whole point of testing it centrally.
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { toFieldDef as mysql }  from '../mysql/to-field.js';
import { toFieldDef as sqlite } from '../sqlite/to-field.js';

const drivers = { mysql, sqlite };

// Extract just the `DEFAULT …` token from a generated column definition (null if absent).
const defaultOf = (toFieldDef, prop) => toFieldDef('f', prop).match(/ DEFAULT (.+)$/)?.[1] ?? null;

const cases = [
    ['boolean false → 0',            { type: 'boolean', default: false },               '0'],
    ['boolean true → 1',             { type: 'boolean', default: true },                '1'],
    ['integer unquoted',             { type: 'integer', default: 5 },                   '5'],
    ['number unquoted',              { type: 'number',  default: 1.5 },                 '1.5'],
    ['string quoted',                { type: 'string', maxLength: 10, default: 'hi' },  "'hi'"],
    ['boolean on a string → empty',  { type: 'string', maxLength: 10, default: false }, "''"],
    ['no default → no clause',       { type: 'integer' },                               null],
];

for (const [name, toFieldDef] of Object.entries(drivers)) {
    for (const [desc, prop, expected] of cases) {
        Deno.test(`default coercion [${name}] ${desc}`, () => {
            assertEquals(defaultOf(toFieldDef, prop), expected);
        });
    }
}
