// sqlite/schema-from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { schemaFromField } from './from-field.js'

const dialect = {
    tables:    async (query) => (await query("SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name),
    fields:    async (query, table) => query(`PRAGMA table_info(\`${table}\`)`),
    fromField: (col) => ({
        name:       col.name,
        prop:       schemaFromField(col),
        isRequired: col.notnull === 1 && !col.pk,
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
