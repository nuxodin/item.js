import { validate as validateSchema } from './validator.js';

// x-dataref convention:
//   '../../groups'    → the groups table
//   '../../groups/$'  → the specific entry: groups.item(this.value)
//
// path parts:
//   ..   = parent
//   .    = self
//   #    = schema root
//   $    = item(currentValue)  ← resolves the FK to a concrete item
//   name = named child

export function getSchemaRoot(item) {
    let p = item
    while (p.parent && p.parent.schema) p = p.parent
    return p
}


export function resolveRef(ref, item, skipLevels = 0) {
    const parts = ref.split('/').filter(p => p !== '');
    let anchor = item;
    if (parts[0] === '#') {
        anchor = getSchemaRoot(item);
        parts.shift();
        skipLevels = 0;
    }
    let skip = skipLevels;
    while (skip > 0) {
        if (parts[0] === '..') { parts.shift(); skip--; }
        else return undefined;
    }
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === '..') anchor = anchor?.parent;
        else if (part === '.') {}
        else return anchor?.has(parts.slice(i));
        if (!anchor) return undefined;
    }
    return anchor;
}

function zzzzresolveRef(ref, item) {
    const parts = ref.split('/');
    let anchor = item;
    for (const part of parts) {
        //if (part === '#') { while (anchor.parent) anchor = anchor.parent } // data-root
        if (part === '#') anchor = getSchemaRoot(item); // schema-root, besser!?
        else if (part === '..') anchor = anchor.parent;
        else if (part === '.') {}
        else anchor = anchor.item(part);
    }
    return anchor;
}

// export function resolveDataRef(item) {
//     const xref = item.schema?.['x-dataref'];
//     if (!xref) return undefined;
//     return resolveRef(xref, item);
// }


export function resolveDataRef(item) {
    const xref = item.schema?.['x-dataref'];
    if (!xref) return undefined;
    const hasValueRef = xref.endsWith('/$');
    const parentRef = hasValueRef ? xref.slice(0, -2) : xref;
    const parent = resolveRef(parentRef, item);
    const refItem = parent?.has(item);
    return { parent, refItem };
}

export function reportDeprecated(item) {
    item.addEventListener('getIn', e => {
        if (e.target.schema?.deprecated) {
            console.error(`item deprecated: ${e.target.path.join('/')}`, e.target.schema);
        }
    });
}

export function validate(e, options = { log: true }) {
    const schema = e.target.schema;
    if (!schema) return;
    const value = e.value;
    if (!validateSchema(schema, value).length) return;
    e.preventDefault();
    if (options.throw) throw new Error(`item invalid: ${e.target.path.join('/')}`);
    if (options.log) console.error(`item invalid: ${e.target.path.join('/')}`, e.target.schema);
}

export function transform(event) {

    if (event.options?.local) return; // comes from the server, we trust it
    if (!event.target.schema) { return; }
    if (event.target.schema.properties) { return; }
    if (event.target.schema.additionalProperties) { return; }
    if (event.value !== null && typeof event.value === 'object') { return; }

    // first the native types
    if (event.target.schema.type === 'integer') event.value = parseInt(event.value);
    if (event.target.schema.type === 'number')  event.value = parseFloat(event.value);
    if (event.target.schema.type === 'boolean') event.value = !!event.value;


    let trim = true; // default
    if ('x-transform' in event.target.schema) {
        trim = event.target.schema['x-transform'].trim ?? true;
    }
    if (event.target.schema.type === 'string') {

        if (trim==='L') event.value = event.value?.trimStart?.();
        if (trim==='R') event.value = event.value?.trimEnd?.();
        if (trim===true) event.value = event.value?.trim?.();

        if (event.value != null) {
            const c = event.target.schema?.['x-transform']?.case;
            if (c === 'lower') event.value = event.value.toLowerCase();
            if (c === 'upper') event.value = event.value.toUpperCase();
        }

    }

}
