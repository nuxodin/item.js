// PostgreSQL dialect descriptor — pure SQL knowledge, no connection.
import { schemaFromDb } from '../../schema/db/pg/from-db.js';
import { makeColumns } from '../shared.js';
import { sql } from '../sql.js';

export const pg = {
    name: 'postgres',
    quoteId: (name) => `"${String(name).replaceAll('"', '""')}"`,
    placeholder: (n) => '$' + n,
    emptyInsert: 'DEFAULT VALUES',
    insertId: 'returning',
    // pg has no lastInsertId; the id comes back via RETURNING (used by connect.exec).
    appendReturning: (frag, col) => sql`${frag} RETURNING ${sql.id(col)}`,
    columns: makeColumns(schemaFromDb),
};
