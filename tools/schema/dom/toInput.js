
export function toInput(schema = {}, { value, required, disabled, name } = {}) {
    const el = schema.enum ? toSelect(schema) : toNativeInput(schema)

    // placeholder from examples or description
    if (schema.examples?.[0] != null) el.placeholder = schema.examples[0]
    else if (schema.description)      el.placeholder = schema.description

    if (required)             el.required  = true
    if (disabled)             el.disabled  = true
    if (schema.readOnly)      el.readOnly  = true
    if (schema.title)         el.title     = schema.title
    if (name)                 el.name      = name

    if (value != null && typeof value === 'object') {
        console.warn('toInput: value is object', schema, value);
        value = '-';
    }

    setValue(el, value ?? schema.default)

    return el
}

// ── internals ─────────────────────────────────────────────────────────────────

function toNativeInput(schema) {
    const type = resolveType(schema)

    if (type === 'textarea') {
        const el = document.createElement('textarea')
        if (schema.maxLength != null) el.maxLength = schema.maxLength
        if (schema.minLength != null) el.minLength = schema.minLength
        return el
    }

    const el  = document.createElement('input')
    el.type   = type

    if (type === 'number') {
        const isInt = schema.type === 'integer'
        el.step = schema.multipleOf ?? (isInt ? 1 : 'any')
        if (schema.minimum          != null) el.min = schema.minimum
        if (schema.maximum          != null) el.max = schema.maximum
        if (schema.exclusiveMinimum != null) el.min = isInt ? schema.exclusiveMinimum + 1 : schema.exclusiveMinimum + Number.EPSILON
        if (schema.exclusiveMaximum != null) el.max = isInt ? schema.exclusiveMaximum - 1 : schema.exclusiveMaximum - Number.EPSILON
    }

    if (type === 'text') {
        if (schema.maxLength != null) el.maxLength = schema.maxLength
        if (schema.minLength != null) el.minLength = schema.minLength
        if (schema.pattern)           el.pattern   = schema.pattern
    }

    if (type === 'file' && schema.contentMediaType) el.accept = schema.contentMediaType

    if (schema.const != null) { el.readOnly = true }

    return el
}

function toSelect(schema) {
    const el       = document.createElement('select')
    const nullable = Array.isArray(schema.type)
        ? schema.type.includes('null')
        : schema.type === 'null'

    if (nullable) {
        const opt = document.createElement('option')
        opt.value = ''
        opt.textContent = '—'
        el.append(opt)
    }
    for (const v of schema.enum) {
        const opt = document.createElement('option')
        opt.value       = v ?? ''
        opt.textContent = v ?? '—'
        el.append(opt)
    }
    return el
}

export function resolveType(schema) {
    const { type, format, contentEncoding, writeOnly, maxLength, minLength } = schema
    if (writeOnly)                    return 'password'
    if (schema.const != null)         return 'text'
    if (contentEncoding === 'base64') return 'file'
    if (format === 'date')            return 'date'
    if (format === 'date-time')       return 'datetime-local'
    if (format === 'time')            return 'time'
    if (format === 'email')           return 'email'
    if (format === 'uri')             return 'url'
    if (format === 'color')           return 'color'
    if (type === 'integer')           return 'number'
    if (type === 'number')            return 'number'
    if (type === 'boolean')           return 'checkbox'
    // unbounded strings → textarea
    //if (type === 'string' && maxLength??0 == null && minLength == null) return 'textarea'
    if (schema['x-multiline'] != null) return schema['x-multiline'] ? 'textarea' : 'text';
    if (type === 'string' && (maxLength??0) > 100) return 'textarea';
    return 'text';
}

function setValue(el, value) {
    if (el.type === 'checkbox') {
        if (value == null) {
            el.indeterminate = true;
        } else {
            el.checked = !!value;
        }
    } else {
        if (value == null) {
            el.value = '';
        } else {
            el.value = String(value);
        }
    }
}
