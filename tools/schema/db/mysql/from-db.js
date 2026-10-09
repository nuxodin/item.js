// mysql/from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { queryRows, quoteId } from '../shared/sql.js'
import { schemaFromField } from './from-field.js'

const dialect = {
    tables:    async (query) => (await queryRows(query, 'SHOW TABLES')).map(r => Object.values(r)[0]),
    fields:    async (query, table) => {
        const rows = await queryRows(query, `SHOW FULL FIELDS FROM ${quoteId(table)}`)
        // MariaDB's JSON is LONGTEXT with a json_valid() check: read back as text it would be altered on every run
        const checks = await queryRows(query, `SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = '${String(table).replaceAll("'", "''")}'`).catch(() => [])
        const json = new Set(checks.map(c => /^json_valid\(`(.+)`\)$/.exec(String(c.CHECK_CLAUSE))?.[1]))
        return rows.map(r => json.has(r.Field) ? { ...r, Type: 'json' } : r)
    },
    fromField: (row) => ({
        name:       row.Field,
        prop:       schemaFromField(row),
        isRequired: row.Null === 'NO',
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
