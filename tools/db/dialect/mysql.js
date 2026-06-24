// MySQL dialect descriptor — pure SQL knowledge, no connection.
import { schemaFromDb } from '../../schema/db/mysql/from-db.js';
import { makeColumns } from '../shared.js';

export const mysql = {
    name: 'mysql',
    quoteId: (name) => `\`${String(name).replaceAll('`', '``')}\``,
    placeholder: () => '?',
    emptyInsert: '() VALUES ()',
    insertId: 'lastId',
    columns: makeColumns(schemaFromDb),
};
