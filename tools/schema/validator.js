
/**
 * Lightweight JSON Schema Validator
 * 
 * @param {Object} schema - JSON Schema
 * @param {any} data - Data to validate
 * @param {string} path - JSON Pointer to current location in data
 * @returns {Array} - Array of {path,msg} error objects
 */

export function validate(schema, data, path = '#') {
    const errs = [];
    const err = msg => errs.push({ path, msg });
    const sub = (s, v, p) => errs.push(...validate(s, v, p));

    for (const [kw, fn] of Object.entries(rules)) {
        if (!(kw in schema)) continue;
        const r = fn(schema, data, path, sub);
        if (typeof r === 'string') err(r);
        else if (r?.length) errs.push(...r);
    }
    return errs;
}

const rules = {
    // universal
    const: (s, d) => !deepEq(d, s.const) && `must be ${JSON.stringify(s.const)}`,
    enum: (s, d) => !s.enum.some(v => deepEq(v, d)) && `must be one of ${JSON.stringify(s.enum)}`,
    type: (s, d) => { const ts = [].concat(s.type); return !ts.some(t => checkType(t, d)) && `must be type ${ts.join('|')} (got ${jsType(d)})`; },

    // string
    minLength: (s, d) => typeof d === 'string' && d.length < s.minLength && `minLength ${s.minLength} (got ${d.length})`,
    maxLength: (s, d) => typeof d === 'string' && d.length > s.maxLength && `maxLength ${s.maxLength} (got ${d.length})`,
    pattern: (s, d) => typeof d === 'string' && !new RegExp(s.pattern).test(d) && `pattern /${s.pattern}/ not matched`,

    // number
    minimum: (s, d) => typeof d === 'number' && d < s.minimum && `minimum ${s.minimum} (got ${d})`,
    maximum: (s, d) => typeof d === 'number' && d > s.maximum && `maximum ${s.maximum} (got ${d})`,
    exclusiveMinimum: (s, d) => typeof d === 'number' && d <= s.exclusiveMinimum && `exclusiveMinimum ${s.exclusiveMinimum}`,
    exclusiveMaximum: (s, d) => typeof d === 'number' && d >= s.exclusiveMaximum && `exclusiveMaximum ${s.exclusiveMaximum}`,
    multipleOf: (s, d) => typeof d === 'number' && d % s.multipleOf !== 0 && `must be multiple of ${s.multipleOf}`,

    // array
    minItems: (s, d) => Array.isArray(d) && d.length < s.minItems && `minItems ${s.minItems} (got ${d.length})`,
    maxItems: (s, d) => Array.isArray(d) && d.length > s.maxItems && `maxItems ${s.maxItems} (got ${d.length})`,
    uniqueItems: (s, d) => Array.isArray(d) && s.uniqueItems && d.length !== new Set(d.map(JSON.stringify)).size && 'items must be unique',
    items: (s, d, path, sub) => Array.isArray(d) && d.forEach((item, i) => {
        const sc = Array.isArray(s.items) ? s.items[i] : s.items;
        if (sc) sub(sc, item, `${path}[${i}]`);
    }),

    // object — returns array of {path,msg} for multi-path errors
    required: (s, d, path) => isObj(d) &&
        s.required.filter(k => !(k in d)).map(k => ({ path: `${path}.${k}`, msg: 'is required' })),
    properties: (s, d, path, sub) => isObj(d) &&
        Object.entries(s.properties).forEach(([k, sc]) => k in d && sub(sc, d[k], `${path}.${k}`)),
    additionalProperties: (s, d, path, sub) => {
        if (!isObj(d)) return;
        const props = s.properties || {};
        const extra = Object.entries(d).filter(([k]) => !(k in props));
        if (s.additionalProperties === false)
            return extra.map(([k]) => ({ path: `${path}.${k}`, msg: 'additional property not allowed' }));
        if (typeof s.additionalProperties === 'object')
            extra.forEach(([k, v]) => sub(s.additionalProperties, v, `${path}.${k}`));
    },

    // composition
    allOf: (s, d, path, sub) => s.allOf.forEach(sc => sub(sc, d, path)),
    anyOf: (s, d, path) => !s.anyOf.some(sc => validate(sc, d, path).length === 0) && 'must match at least one of anyOf',
    oneOf: (s, d, path) => { const n = s.oneOf.filter(sc => validate(sc, d, path).length === 0).length; return n !== 1 && `must match exactly one of oneOf (matched ${n})`; },
    not: (s, d, path) => validate(s.not, d, path).length === 0 && 'must not match "not" schema',
    if: (s, d, path, sub) => { const branch = validate(s.if, d, path).length === 0 ? s.then : s.else; if (branch) sub(branch, d, path); },
};

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkType(t, v) {
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number' && !isNaN(v);
    if (t === 'null') return v === null;
    if (t === 'array') return Array.isArray(v);
    if (t === 'object') return isObj(v);
    return typeof v === t;
}

function jsType(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (Number.isInteger(v)) return 'integer';
    return typeof v;
}
