// SQLite dialect descriptor — pure SQL knowledge, no connection.
import { schemaFromDb } from '../../schema/db/sqlite/from-db.js';
import { makeColumns } from '../shared.js';

export const sqlite = {
    name: 'sqlite',
    quoteId: (name) => `"${String(name).replaceAll('"', '""')}"`,
    placeholder: () => '?',
    emptyInsert: 'DEFAULT VALUES',
    insertId: 'lastId',
    columns: makeColumns(schemaFromDb),
};
