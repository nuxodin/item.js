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
