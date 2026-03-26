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

function resolveRef(ref, item) {
    const parts = ref.split('/');
    let anchor = item;
    for (const part of parts) {
        //if (part === '#') { while (anchor.parent) anchor = anchor.parent } // data-root
        if (part === '#') anchor = getSchemaRoot(item); // schema-root, besser!?
        else if (part === '..') anchor = anchor.parent;
        else if (part === '.') {}
        else if (part === '$') {
            const value = anchor.get();
            if (value == undefined) return undefined;
            if (typeof value === 'object') console.error('x-dataref: value is object', anchor.path, value);
            anchor = anchor.item(item.value);
        }
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
    // $ abschneiden für parent, behalten für refItem
    const hasValueRef = xref.endsWith('/$');
    const parentRef = hasValueRef ? xref.slice(0, -2) : xref;
    
    const parent = resolveRef(parentRef, item);
    if (typeof item.value == 'object') console.error('x-dataref: value is object', item.path, item.get());
    const refItem = parent?.has(String(item.value));
    
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

// export function useDefault(item) {
//     item.addEventListener('getIn', event => {
//         if (!event.target.filled && 'default' in event.target.schema) {
//             event.value = event.target.schema.default;
//         }
//     });
// }



