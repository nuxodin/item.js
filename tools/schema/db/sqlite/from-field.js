// sqlite/schema-from-field.js
// PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
// SQLite lengths are in characters — no byte conversion needed

const intRanges = {
    tinyint:   { signed: [-128, 127]                           },
    smallint:  { signed: [-32768, 32767]                       },
    mediumint: { signed: [-8388608, 8388607]                   },
    int:       { signed: [-2147483648, 2147483647]             },
    integer:   { signed: [-2147483648, 2147483647]             },
    bigint:    { signed: [-9007199254740991, 9007199254740991] }, // JS safe
}

export function schemaFromField(col) {
    const prop = {}
    const raw  = (col.type ?? '').trim()
    const m    = raw.match(/^(\w+)\s*(?:\(([^)]+)\))?/)
    const type = m?.[1]?.toLowerCase() ?? 'text'
    const len  = m?.[2] ? parseInt(m[2]) : null

    if (type in intRanges) {
        const [min, max] = intRanges[type].signed
        prop.type = 'integer'; prop.minimum = min; prop.maximum = max

    } else if (type === 'boolean' || type === 'bool') { prop.type = 'boolean'
    } else if (type === 'real' || type === 'float' || type === 'double') { prop.type = 'number'
    } else if (type === 'numeric' || type === 'decimal') { prop.type = 'number'

    } else if (type === 'varchar' || type === 'nvarchar') {
        prop.type = 'string'; if (len) prop.maxLength = len

    } else if (type === 'char' || type === 'nchar') {
        prop.type = 'string'; if (len) { prop.minLength = len; prop.maxLength = len }

    } else if (type === 'blob') { prop.type = 'string'; prop.contentEncoding = 'base64'
    } else if (type === 'date')      { prop.type = 'string'; prop.format = 'date'
    } else if (type === 'time')      { prop.type = 'string'; prop.format = 'time'
    } else if (type === 'datetime' || type === 'timestamp') { prop.type = 'string'; prop.format = 'date-time'
    } else if (type === 'json')      { prop.type = 'object'
    } else {
        prop.type = 'string'
    }

    if (col.dflt_value != null) prop.default    = col.dflt_value
    if (col.pk)                 prop['x-index'] = 'primary'

    return prop
}