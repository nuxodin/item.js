/*
Usage:
import { canRead, canWrite } from './access.js';
import { resolveVariables } from './condition.js';
const resolvedSchema = resolveVariables(rawSchema, { $user: currentUser });
// schema auf root-item setzen...
await canRead(ticketItem);   // true/false
await canWrite(ticketItem);  // true/false
*/
import { evaluate, resolveVariables } from './condition.js';
import { resolveDataRef } from './schema/utils.js';

export { resolveVariables }; // re-export für Convenience

async function onUnknownOperator(condition, obj, item) {
    if (condition[0] === 'cascade') {
        const fieldItem = item.item(condition[1]);
        const { refItem } = await resolveDataRef(fieldItem) ?? {};
        return refItem ? canRead(refItem) : false;
    }
    return false;
}

async function check(condition, item) {
    return evaluate(condition, item.get(), (cond, obj) => onUnknownOperator(cond, obj, item));
}

export async function canRead(item) {
    const schema = item.schema?.additionalProperties ?? item.schema;
    return await check(schema?.['x-readable'], item) || await check(schema?.['x-writable'], item);
}

export async function canWrite(item) {
    const schema = item.schema?.additionalProperties ?? item.schema;
    return check(schema?.['x-writable'], item);
}