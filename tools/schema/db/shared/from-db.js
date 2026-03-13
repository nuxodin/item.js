// shared/from-db.js

export function schemaFromTable(fields, fromField) {
    const properties = {}, required = []
    for (const f of fields) {
        const { name, prop, isRequired } = fromField(f)
        properties[name] = prop
        if (isRequired) required.push(name)
    }
    return {
        type: 'object',
        additionalProperties: {
            type: 'object',
            properties,
            ...(required.length && { required }),
        }
    }
}

export async function schemaFromDb(db, dialect) {
    const tables  = await dialect.tables(db)
    const entries = await Promise.all(
        tables.map(async t => [t, schemaFromTable(await dialect.fields(db, t), dialect.fromField)])
    )
    return { type: 'object', properties: Object.fromEntries(entries) }
}