// SQLite dialect descriptor — pure SQL knowledge, no connection.
import { schemaFromDb } from '../../schema/db/sqlite/from-db.js';

export const sqlite = {
    name: 'sqlite',
    quoteId: (name) => `"${String(name).replaceAll('"', '""')}"`,
    placeholder: () => '?',
    emptyInsert: 'DEFAULT VALUES',
    insertId: 'lastId',

    /** Column schemas for one table; introspection delegated to tools/schema. */
    async columns(query, table) {
        const schema = await schemaFromDb(query);
        return schema.properties[table]?.additionalProperties?.properties ?? {};
    },
};
