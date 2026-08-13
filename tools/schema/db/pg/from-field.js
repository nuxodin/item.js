// pg/from-field.js

const intRanges = {
    int2:     [-32768, 32767],
    smallint: [-32768, 32767],
    int4:     [-2147483648, 2147483647],
    integer:  [-2147483648, 2147483647],
    int8:     [-9007199254740991, 9007199254740991], // JS safe
    bigint:   [-9007199254740991, 9007199254740991],
}

const floats = new Set(['float4', 'float8', 'real', 'double precision'])
const strings = new Set(['varchar', 'bpchar'])

export function schemaFromField(row) {
    const prop = {}
    const type = String(row.udt_name || row.data_type || '').toLowerCase()
    const dataType = String(row.data_type || '').toLowerCase()
    const isAuto = row.is_identity === 'YES' || /^nextval\(/i.test(row.column_default ?? '')

    if (type === 'bool' || dataType === 'boolean') prop.type = 'boolean'
    else if (type in intRanges) {
        const [min, max] = intRanges[type]
        prop.type = 'integer'
        if (!isAuto) { prop.minimum = min; prop.maximum = max }
    } else if (floats.has(type) || floats.has(dataType)) prop.type = 'number'
    else if (type === 'numeric' || dataType === 'numeric') {
        prop.type = 'number'
        if (row.numeric_scale > 0) prop.multipleOf = Math.pow(10, -row.numeric_scale)
    } else if (strings.has(type)) {
        prop.type = 'string'
        if (row.character_maximum_length) prop.maxLength = row.character_maximum_length
        if (type === 'bpchar' && row.character_maximum_length) prop.minLength = row.character_maximum_length
    } else if (type === 'bytea') {
        prop.type = 'string'
        prop.contentEncoding = 'base64'
    } else if (type === 'date') {
        prop.type = 'string'
        prop.format = 'date'
    } else if (type.startsWith('timestamp') || dataType.startsWith('timestamp')) {
        prop.type = 'string'
        prop.format = 'date-time'
    } else if (type.startsWith('time') || dataType.startsWith('time')) {
        prop.type = 'string'
        prop.format = 'time'
    } else if (type === 'json' || type === 'jsonb') prop.type = 'object'
    else prop.type = 'string'

    const def = parseDefault(row.column_default, prop.type)
    if (def !== undefined) prop.default = def
    if (row.comment) prop['$comment'] = row.comment
    if (row.is_primary) prop['x-index'] = 'primary'
    else if (row.is_unique) prop['x-index'] = 'unique'
    else if (row.is_index) prop['x-index'] = true
    if (isAuto) prop['x-autoincrement'] = true
    return prop
}

/** information_schema hands the default back as an SQL literal — read it as the value the schema would declare. */
function parseDefault(value, type) {
    if (value == null || /^nextval\(/i.test(value) || /\b(current_|now\()/i.test(value)) return undefined
    let v = String(value).replace(/::[\w\s.[\]"]+$/i, '')
    if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'")
    const n = Number(v)
    if (type === 'boolean') return /^(true|t|1)$/i.test(v)
    if ((type === 'integer' || type === 'number') && !isNaN(n)) return n
    return v
}
