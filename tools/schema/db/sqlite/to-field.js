// sqlite/to-field.js — JSON Schema property → SQLite column definition
// SQLite lengths are in characters — no byte conversion needed
// Intentionally no NOT NULL for required fields: SQLite has no non-strict mode that
// fills implicit defaults like MySQL, so inserts omitting required fields would fail.
import { quoteId, schemaType, defaultLiteral } from '../shared/sql.js'

export function toFieldDef(name, prop) {
    let type
    const t = schemaType(prop)

    if      (t === 'boolean')             type = 'INTEGER'  // SQLite has no bool
    else if (t === 'integer')             type = 'INTEGER'
    else if (t === 'number')              type = 'REAL'
    else if (t === 'object' || t === 'array') type = 'TEXT'  // JSON as text
    else {
        if      (prop.format === 'date')          type = 'TEXT'
        else if (prop.format === 'time')          type = 'TEXT'
        else if (prop.format === 'date-time')     type = 'TEXT'
        else if (prop.contentEncoding === 'base64') type = 'BLOB'
        else if (prop.maxLength)                  type = `VARCHAR(${prop.maxLength})`
        else                                      type = 'TEXT'
    }

    // PRIMARY KEY / AUTOINCREMENT are emitted inline by to-db.js for the single
    // integer-primary case; SQLite rejects AUTOINCREMENT in any other position.
    let sql = `${quoteId(name)} ${type}`
    if (prop.default != null) sql += ` DEFAULT ${defaultLiteral(prop)}`

    return sql
}
