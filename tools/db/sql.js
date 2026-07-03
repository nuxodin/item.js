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
sql.id = (name) => new Sql([{ id: String(name) }]);

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

// Lower an AST to { text, params } for a dialect. Stays dialect-agnostic: the
// dialect (quoteId + placeholder) is passed in, never imported here.
/** @param {Sql} frag  @param {{quoteId(name:string):string, placeholder(n:number):string}} dialect */
export function render(frag, dialect) {
    let text = '';
    const params = [];
    for (const part of frag.parts) {
        if ('text' in part) text += part.text;
        else if ('id' in part) text += dialect.quoteId(part.id);
        else { params.push(part.param); text += dialect.placeholder(params.length); }
    }
    return { text, params };
}

// Companion to the sql`` tag: lets a query API accept either a tagged template
// or a pre-built Sql fragment, and dispatch on which it got.
/** True for a tagged-template call (first arg is the template strings array). */
export function isTemplate(a) {
    return Array.isArray(a?.raw);
}
