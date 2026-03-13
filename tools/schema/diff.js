// ── Generic JSON diff ─────────────────────────────────────────────────────────

export function jsonDiff(next, orig, classify, path = []) {
    const diffs = []
    const keys = new Set([...Object.keys(orig ?? {}), ...Object.keys(next ?? {})])
    for (const key of keys) {
        const a = orig?.[key]
        const b = next?.[key]
        const p = [...path, key]
        if (a === b) continue
        if (isObject(a) && isObject(b)) {
            diffs.push(...jsonDiff(b, a, classify, p))
            continue
        }
        const destructive = classify(key, a, b)
        diffs.push({
            path: p,
            property: key,
            msg: destructive === null ? null : describeChange(key, a, b),
            prev: a,
            next: b,
            destructive,
        })
    }
    return diffs
}

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function describeChange(key, a, b) {
    if (a === undefined) return `${key} added`
    if (b === undefined) return `${key} removed`
    return `${key} changed`
}

// ── Schema-specific rules ─────────────────────────────────────────────────────

const schemaRules = {
    type:          (a, b) => a !== undefined && b !== undefined,  // type change = always destructive
    maxLength:     (a, b) => b < a,
    minLength:     (a, b) => b > a,
    minimum:       (a, b) => b > a,
    maximum:       (a, b) => b < a,
    minItems:      (a, b) => b > a,
    maxItems:      (a, b) => b < a,
    minProperties: (a, b) => b > a,
    maxProperties: (a, b) => b < a,
    required:      (a, b) => {  // new required fields = destructive
        if (!Array.isArray(a) || !Array.isArray(b)) return true
        return b.some(f => !a.includes(f))
    },
    enum:          (a, b) => {  // removing enum values = destructive
        if (!Array.isArray(a) || !Array.isArray(b)) return true
        return a.some(v => !b.includes(v))
    },
    // tightening = destructive, loosening = safe
    additionalProperties: (a, b) => b === false && a !== false,
    uniqueItems:          (a, b) => b === true && a !== true,
    pattern:              (a, b) => a !== b,   // any regex change may reject existing data
    format:               (a, b) => a !== b,   // format change may reject existing data
    const:                (a, b) => a !== b,
    contains:             (a, b) => a !== b,
    // always safe
    'x-index':           (a, b) => a === 'primary' && b !== 'primary',  // removing primary = destructive
    properties:          () => false,
    patternProperties:   () => false,
    description:  () => false,
    title:        () => false,
    default:      () => false,
    examples:     () => false,
    '$comment':   () => false,
    '$schema':    () => false,
    '$id':        () => false,
    readOnly:     () => false,
    writeOnly:    () => false,
    deprecated:   () => false,
}

export function schemaDiff(next, orig) {
    return jsonDiff(next, orig, (prop, a, b) => {
        const rule = schemaRules[prop]
        if (!rule) {
            if (b === undefined) return isObject(a) ? true : false  // whole field removed = destructive
            if (a === undefined) return false                        // whole field added = safe
            return null                                              // unknown change → flag
        }
        if (b === undefined) return false  // removal of a constraint = safe
        if (a === undefined) return false  // addition = safe
        return rule(a, b)
    })
}