// Helpers shared across dialect descriptors.

/** Build a `columns(query, table)` that delegates introspection to a schema from-db. */
export const makeColumns = (schemaFromDb) => async (query, table) => {
    const schema = await schemaFromDb(query);
    return schema.properties[table]?.additionalProperties?.properties ?? {};
};
