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

export function resolveDataRef(item) {
    const xref = item.schema?.['x-dataref']
    if (!xref) return null;
    const parts = xref.split('/');
    let anchor = item;
    for (const part of parts) {
        //if (part === '#') { while (anchor.parent) anchor = anchor.parent } // data-root
        if (part === '#') anchor = getSchemaRoot(item); // schema-root, besser!?
        else if (part === '..') anchor = anchor.parent;
        else if (part === '.') {}
        else if (part === '$') anchor = anchor.item(item.value);
        else anchor = anchor.item(part);
    }
    return anchor;
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
    const value = e.detail.value;
    if (!validateSchema(schema, value).length) return;
    e.preventDefault();
    if (options.throw) throw new Error(`item invalid: ${e.target.path.join('/')}`);
    if (options.log) console.error(`item invalid: ${e.target.path.join('/')}`, e.target.schema);
}

export function transform(event) {
    if ('x-transform' in e.target.schema) {
        const trim = e.target.schema['x-transform'].trim;
        if (trim==='L') event.value = event.value?.trimStart?.();
        if (trim==='R') event.value = event.value?.trimEnd?.();
        if (trim===true) event.value = event.value?.trim?.();
    }
}

// export function useDefault(item) {
//     item.addEventListener('getIn', event => {
//         if (!event.target.filled && 'default' in event.target.schema) {
//             event.value = event.target.schema.default;
//         }
//     });
// }



