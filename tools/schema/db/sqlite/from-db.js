// sqlite/from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { queryRows, quoteId } from '../shared/sql.js'
import { schemaFromField } from './from-field.js'

/** Single-column, non-constraint indexes: [{ name, column, unique }]. */
export async function singleColumnIndexes(query, table) {
    const out = []
    for (const row of await queryRows(query, `PRAGMA index_list(${quoteId(table)})`)) {
        if (row.origin && row.origin !== 'c') continue
        const cols = await queryRows(query, `PRAGMA index_info(${quoteId(row.name)})`)
        if (cols.length === 1) out.push({ name: row.name, column: cols[0].name, unique: !!row.unique })
    }
    return out
}

async function indexes(query, table) {
    const map = new Map()
    for (const { column, unique } of await singleColumnIndexes(query, table))
        map.set(column, unique ? 'unique' : true)
    return map
}

const dialect = {
    tables:    async (query) => (await queryRows(query, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map(r => r.name),
    fields:    async (query, table) => {
        const ix = await indexes(query, table)
        // AUTOINCREMENT survives only in the stored DDL — no PRAGMA reports it
        const [master] = await queryRows(query, `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table.replaceAll("'", "''")}'`)
        const auto = /\bautoincrement\b/i.test(master?.sql ?? '')
        return (await queryRows(query, `PRAGMA table_info(${quoteId(table)})`)).map(row =>
            row.pk ? { ...row, autoincrement: auto }
                   : ix.has(row.name) ? { ...row, index: ix.get(row.name) } : row
        )
    },
    fromField: (row) => ({
        name:       row.name,
        prop:       schemaFromField(row),
        isRequired: row.notnull === 1 && !row.pk,
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
