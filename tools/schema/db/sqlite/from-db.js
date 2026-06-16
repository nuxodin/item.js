// sqlite/schema-from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { quoteId } from '../shared/sql.js'
import { schemaFromField } from './from-field.js'

async function indexes(query, table) {
    const map = new Map()
    for (const row of await query(`PRAGMA index_list(${quoteId(table)})`)) {
        if (row.origin && row.origin !== 'c') continue
        const cols = await query(`PRAGMA index_info(${quoteId(row.name)})`)
        if (cols.length === 1) map.set(cols[0].name, row.unique ? 'unique' : true)
    }
    return map
}

const dialect = {
    tables:    async (query) => (await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(r => r.name),
    fields:    async (query, table) => {
        const ix = await indexes(query, table)
        return (await query(`PRAGMA table_info(${quoteId(table)})`)).map(row =>
            row.pk || !ix.has(row.name) ? row : { ...row, index: ix.get(row.name) }
        )
    },
    fromField: (row) => ({
        name:       row.name,
        prop:       schemaFromField(row),
        isRequired: row.notnull === 1 && !row.pk,
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
