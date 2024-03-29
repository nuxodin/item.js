

import { Schema } from '../../jema.js/schema.js';

export function attachSchema(rootItem, schema) {
    schema = new Schema(schema);
    rootItem.schema = schema.schema;
    rootItem.addEventListener('setIn', e => { // event should trigger at the end, after possible transformations

        const value = rootItem.get();

        for (const error of schema.errors(value)) {
            e.preventDefault();
            console.error(error)
        }
    });
}



// import { errors } from '../../jema.js/schema.js';

// export function attachSchema(rootItem, schema) {
//     rootItem.schema = new Schema(schema);
//     const rootLevel = rootItem.path.length;

//     rootItem.addEventListener('setIn', e => { // event should trigger at the end, after possible transformations
//         const detail = e.detail;
//         const path = detail.item.path.splice(1, rootLevel);

//         let currentSchema = rootItem.schema;
//         for (const current of path) {
//             currentSchema = currentSchema?.properties?.[current.key];
//             if (!currentSchema) return;
//         }

//         const fails = [...errors(detail.value, currentSchema)];

//         if (fails.length > 0) {
//             e.preventDefault();
//             const msg = fails.length+' jsonSchema errors:' + '\n' + fails.join('\n');
//             throw new Error(msg);
//         }
//     });
// }
