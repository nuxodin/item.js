// mysql/to-field.js — JSON Schema property → MySQL column definition

const B = 4  // bytes per char, worst-case utf8mb4

export function toFieldDef(name, prop) {
    let type, unsigned = false

    if (prop.type === 'boolean') {
        type = 'TINYINT(1)'

    } else if (prop.type === 'integer') {
        const min = prop.minimum ?? -Infinity
        const max = prop.maximum ?? Infinity
        if (min >= 0) {
            unsigned = true
            if      (max <= 255)        type = 'TINYINT'
            else if (max <= 65535)      type = 'SMALLINT'
            else if (max <= 16777215)   type = 'MEDIUMINT'
            else if (max <= 4294967295) type = 'INT'
            else                        type = 'BIGINT'
        } else {
            if      (min >= -128        && max <= 127)        type = 'TINYINT'
            else if (min >= -32768      && max <= 32767)      type = 'SMALLINT'
            else if (min >= -8388608    && max <= 8388607)    type = 'MEDIUMINT'
            else if (min >= -2147483648 && max <= 2147483647) type = 'INT'
            else                                              type = 'BIGINT'
        }

    } else if (prop.type === 'number') {
        type = prop.multipleOf ? `DECIMAL` : 'DOUBLE'

    } else if (prop.type === 'object' || prop.type === 'array') {
        type = 'JSON'

    } else { // string
        if      (prop.format === 'date')      type = 'DATE'
        else if (prop.format === 'time')      type = 'TIME'
        else if (prop.format === 'date-time') type = 'DATETIME'
        else if (prop.contentEncoding === 'base64') {
            const len = prop.maxLength
            type = len ? `VARBINARY(${len})` : 'BLOB'
        } else {
            const maxBytes = (prop.maxLength ?? Infinity) * B
            if      (maxBytes <= 255)      type = `VARCHAR(${(prop.maxLength ?? 63) * B})`
            else if (maxBytes <= 65535)    type = 'TEXT'
            else if (maxBytes <= 16777215) type = 'MEDIUMTEXT'
            else                           type = 'LONGTEXT'
        }
    }

    let sql = `\`${name}\` ${type}`
    if (unsigned)                  sql += ' UNSIGNED'
    if (prop['x-autoincrement'])   sql += ' AUTO_INCREMENT'
    if (prop.default != null)      sql += ` DEFAULT '${String(prop.default).replace(/'/g, "''")}'`
    if (prop['$comment'])          sql += ` COMMENT '${prop['$comment'].replace(/'/g, "''")}'`

    return sql
}