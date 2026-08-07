// shared/needs-ddl.js — does the existing column still satisfy the schema?
//
// The schema travels with the database and holds what no DDL expresses (pattern, enum, required,
// x-*). Reconstructing a schema from the database is lossy, so comparing the two for equality
// turns every gap into a change and rebuilds every table forever. Each property gets the question
// that fits it: capacity asks whether the column still holds what the schema wants (widen only),
// structural asks for equality, everything else is enforced by the application alone.
import { schemaType } from './sql.js'

const capacity = {
    maximum:   (need, have) => have >= need,
    minimum:   (need, have) => have <= need,
    maxLength: (need, have) => have >= need,
}

const structural = ['contentEncoding', 'x-index', 'default']

// Only these three formats become a column type in any dialect. `email`, `uri` and the rest are
// the application's business — a column cannot carry them, so they can never need DDL.
const temporal = new Set(['date', 'time', 'date-time'])
const columnFormat = (prop) => temporal.has(prop.format) ? prop.format : undefined

/** @param dialectStructural properties this dialect renders too, e.g. 'multipleOf' on MySQL. */
export function fieldNeedsDdl(next, curr, dialectStructural = []) {
    for (const [prop, holds] of Object.entries(capacity)) {
        const need = next[prop], have = curr[prop]
        // no requirement, or a bound the database never reported — nothing to widen towards
        if (need !== undefined && have !== undefined && !holds(need, have)) return true
    }
    if (schemaType(next) !== schemaType(curr)) return true
    if (columnFormat(next) !== columnFormat(curr)) return true
    if (!!next['x-autoincrement'] !== !!curr['x-autoincrement']) return true
    return [...structural, ...dialectStructural].some(prop => next[prop] !== curr[prop])
}
