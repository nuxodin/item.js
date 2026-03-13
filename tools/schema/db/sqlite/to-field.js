// sqlite/to-field.js — JSON Schema property → SQLite column definition

export function toFieldDef(name, prop) {
    let type

    if      (prop.type === 'boolean')             type = 'INTEGER'  // SQLite has no bool
    else if (prop.type === 'integer')             type = 'INTEGER'
    else if (prop.type === 'number')              type = 'REAL'
    else if (prop.type === 'object' || prop.type === 'array') type = 'TEXT'  // JSON as text
    else {
        if      (prop.format === 'date')          type = 'TEXT'
        else if (prop.format === 'time')          type = 'TEXT'
        else if (prop.format === 'date-time')     type = 'TEXT'
        else if (prop.contentEncoding === 'base64') type = 'BLOB'
        else if (prop.maxLength)                  type = `VARCHAR(${prop.maxLength})`
        else                                      type = 'TEXT'
    }

    let sql = `\`${name}\` ${type}`
    if (prop['x-autoincrement'])  sql += ' AUTOINCREMENT'
    if (prop.default != null)     sql += ` DEFAULT '${String(prop.default).replace(/'/g, "''")}'`

    return sql
}