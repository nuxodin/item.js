
export function inputNode(schema = {}, { value, required, disabled, name } = {}) {
    if (value != null && typeof value === 'object') {
        console.warn('inputNode: value is object', schema, value)
        value = '-'
    }

    const node = schema.enum ? selectNode(schema) : nativeNode(schema)

    if (schema.examples?.[0] != null) node.attrs.placeholder = schema.examples[0]
    else if (schema.description)      node.attrs.placeholder = schema.description

    if (required)         node.attrs.required = true
    if (disabled)         node.attrs.disabled = true
    if (schema.readOnly)  node.attrs.readonly = true
    if (schema.title)     node.attrs.title    = schema.title
    if (name)             node.attrs.name     = name

    applyValue(node, value ?? schema.default)

    if (schema['x-html']) {
        const { tag, ...attrs } = schema['x-html']
        if (tag) node.tag = tag
        Object.assign(node.attrs, attrs)
    }

    return node
}

function resolveType(schema) {
    const { type, format, contentEncoding, writeOnly, maxLength } = schema
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
    if (schema['x-multiline'] != null) return schema['x-multiline'] ? 'textarea' : 'text'
    if (type === 'string' && (maxLength??0) > 100) return 'textarea'
    return 'text'
}

// ── internals ─────────────────────────────────────────────────────────────────

function nativeNode(schema) {
    const type = resolveType(schema)

    if (type === 'textarea') {
        const attrs = {}
        if (schema.maxLength != null) attrs.maxlength = schema.maxLength
        if (schema.minLength != null) attrs.minlength = schema.minLength
        return { tag: 'textarea', attrs, children: [] }
    }

    const attrs = { type }

    if (type === 'number') {
        const isInt = schema.type === 'integer'
        attrs.step = schema.multipleOf ?? (isInt ? 1 : 'any')
        if (schema.minimum          != null) attrs.min = schema.minimum
        if (schema.maximum          != null) attrs.max = schema.maximum
        if (schema.exclusiveMinimum != null) attrs.min = isInt ? schema.exclusiveMinimum + 1 : schema.exclusiveMinimum + Number.EPSILON
        if (schema.exclusiveMaximum != null) attrs.max = isInt ? schema.exclusiveMaximum - 1 : schema.exclusiveMaximum - Number.EPSILON
    }

    if (type === 'text') {
        if (schema.maxLength != null) attrs.maxlength = schema.maxLength
        if (schema.minLength != null) attrs.minlength = schema.minLength
        if (schema.pattern)           attrs.pattern   = schema.pattern
    }

    if (type === 'file' && schema.contentMediaType) attrs.accept = schema.contentMediaType

    if (schema.const != null) attrs.readonly = true

    return { tag: 'input', attrs }
}

function selectNode(schema) {
    const nullable = Array.isArray(schema.type)
        ? schema.type.includes('null')
        : schema.type === 'null'

    const children = []
    if (nullable) children.push({ tag: 'option', attrs: { value: '' }, children: ['—'] })
    for (const v of schema.enum) {
        children.push({
            tag: 'option',
            attrs: { value: v ?? '' },
            children: [v == null ? '—' : String(v)],
        })
    }

    return { tag: 'select', attrs: {}, children }
}

function applyValue(node, value) {
    if (node.tag === 'input' && node.attrs.type === 'checkbox') {
        if (value == null) node.attrs.indeterminate = true
        else if (value)    node.attrs.checked       = true
        return
    }
    if (node.tag === 'select') {
        const str = value == null ? '' : String(value)
        for (const opt of node.children) {
            if (String(opt.attrs.value) === str) { opt.attrs.selected = true; break }
        }
        return
    }
    if (value == null) return
    const str = String(value)
    if (node.tag === 'textarea') node.children = [str]
    else                          node.attrs.value = str
}
