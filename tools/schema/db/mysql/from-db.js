// mysql/from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { quoteId } from '../shared/sql.js'
import { schemaFromField } from './from-field.js'

const dialect = {
    tables:    async (query) => (await query('SHOW TABLES')).map(r => Object.values(r)[0]),
    fields:    async (query, table) => query(`SHOW FULL FIELDS FROM ${quoteId(table)}`),
    fromField: (row) => ({
        name:       row.Field,
        prop:       schemaFromField(row),
        isRequired: row.Null === 'NO',
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
