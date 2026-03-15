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

export function transform(e) {
    const detail = e.detail;
    if ('x-transform' in e.target.schema) {
        const trim = e.target.schema['x-transform'].trim;
        if (trim==='L') detail.value = detail.value?.trimStart?.();
        if (trim==='R') detail.value = detail.value?.trimEnd?.();
        if (trim===true) detail.value = detail.value?.trim?.();
    }
}

// export function useDefault(item) {
//     item.addEventListener('getIn', e => {
//         if (!e.target.filled && 'default' in e.target.schema) {
//             e.detail.value = e.target.schema.default;
//         }
//     });
// }



