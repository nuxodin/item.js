// @ts-self-types="./sql.d.ts"
// Dialect-neutral SQL fragments. Build with the sql`` tag — interpolated values
// become bound params, nested fragments/ids compose. A driver renders the AST to
// its dialect (placeholder + identifier quoting) at execution time. Pure data, no dialect.

export class Sql {
    /** @param {Array<{text:string}|{param:unknown}|{id:string}>} parts */
    constructor(parts = []) { this.parts = parts; }
}

/** Tagged template; interpolated values become bound params, nested Sql composes. */
export function sql(strings, ...values) {
    const parts = [];
    strings.forEach((s, i) => {
        if (s) parts.push({ text: s });
        if (i < values.length) {
            const v = values[i];
            if (v instanceof Sql) parts.push(...v.parts);
            else parts.push({ param: v });
        }
    });
    return new Sql(parts);
}

/** Quote a dynamic identifier (table/column) per dialect. */
sql.id = (name) => new Sql([{ id: name }]);

/** Inject text verbatim — escape hatch, never pass user input. */
sql.raw = (text) => new Sql([{ text }]);

/** Join fragments with a separator (IN-lists, column sets). */
sql.join = (frags, separator = ', ') => {
    const parts = [];
    frags.forEach((f, i) => {
        if (i) parts.push({ text: separator });
        parts.push(...f.parts);
    });
    return new Sql(parts);
};

/** A column: a name is quoted per dialect, `a.b` in its parts; anything else is a fragment already. */
const column = (c) => typeof c === 'string' ? sql.join(c.split('.').map(n => sql.id(n)), '.') : c;

/**
 * `x IN (…)`, and a plain `false` where there is nothing to be in — `IN ()` is a syntax error, and
 * an empty subquery cannot be typed for every column (`IN (SELECT NULL WHERE FALSE)` is a type
 * error in postgres). The column belongs inside for exactly that reason: only there can the empty
 * case be a boolean instead of a comparison.
 */
sql.in = (col, values) => {
    const list = [...values];
    return list.length ? sql`${column(col)} IN (${sql.join(list.map(v => sql`${v}`))})` : sql.raw('false');
};

/** The other way round — and nothing to be in means everything qualifies. */
sql.notIn = (col, values) => {
    const list = [...values];
    return list.length ? sql`${column(col)} NOT IN (${sql.join(list.map(v => sql`${v}`))})` : sql.raw('true');
};

// Objects with their own toString bind as strings; plain objects/arrays are
// mistakes (drivers would mangle them, e.g. mysql2's `key`='value' expansion).
function toParam(v) {
    if (v === null || typeof v !== 'object' || v instanceof Date || v instanceof Uint8Array) return v;
    if (Array.isArray(v) || v.toString === Object.prototype.toString) {
        throw new TypeError('sql: cannot bind ' + (Array.isArray(v) ? 'an array' : 'a plain object') + ' as parameter');
    }
    return String(v);
}

// Lower an AST to { text, params } for a dialect. Stays dialect-agnostic: the
// dialect (quoteId + placeholder) is passed in, never imported here.
/** @param {Sql} frag  @param {{quoteId(name:string):string, placeholder(n:number):string}} dialect */
export function render(frag, dialect) {
    let text = '';
    const params = [];
    for (const part of frag.parts) {
        if ('text' in part) text += part.text;
        else if ('id' in part) text += dialect.quoteId(String(part.id));
        else { params.push(toParam(part.param)); text += dialect.placeholder(params.length); }
    }
    return { text, params };
}

/** Await promised params/ids in place, in parallel; a promise resolving to a
 * Sql fragment composes. Run by the query layer before render. */
export async function resolveSql(frag) {
    if (!frag.parts.some(p => p.param instanceof Promise || p.id instanceof Promise)) return;
    frag.parts = (await Promise.all(frag.parts.map(async p => {
        if (p.id instanceof Promise) return [{ id: await p.id }];
        if (!(p.param instanceof Promise)) return [p];
        const v = await p.param;
        if (v instanceof Sql) { await resolveSql(v); return v.parts; }
        return [{ param: v }];
    }))).flat();
}

// Companion to the sql`` tag: lets a query API accept either a tagged template
// or a pre-built Sql fragment, and dispatch on which it got.
/** True for a tagged-template call (first arg is the template strings array). */
export function isTemplate(a) {
    return Array.isArray(a?.raw);
}
