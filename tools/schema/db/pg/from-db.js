// pg/from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'
import { queryRows } from '../shared/sql.js'
import { schemaFromField } from './from-field.js'
import { quoteLit } from './to-field.js'

const dialect = {
    tables: async (query) => (await queryRows(query, `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `)).map(r => r.table_name),

    fields: async (query, table) => queryRows(query, `
        WITH ix AS (
            SELECT a.attname AS column_name,
                   bool_or(i.indisprimary) AS is_primary,
                   bool_or(i.indisunique AND NOT i.indisprimary AND array_length(i.indkey, 1) = 1) AS is_unique,
                   bool_or(NOT i.indisunique AND NOT i.indisprimary AND array_length(i.indkey, 1) = 1) AS is_index
            FROM pg_class t
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_index i ON i.indrelid = t.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
            WHERE n.nspname = 'public' AND t.relname = ${quoteLit(table)}
            GROUP BY a.attname
        )
        SELECT c.column_name, c.data_type, c.udt_name, c.character_maximum_length,
               c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default,
               c.is_identity, d.description AS comment, ix.is_primary, ix.is_unique, ix.is_index
        FROM information_schema.columns c
        LEFT JOIN pg_namespace n ON n.nspname = c.table_schema
        LEFT JOIN pg_class t ON t.relnamespace = n.oid AND t.relname = c.table_name
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
        LEFT JOIN pg_description d ON d.objoid = t.oid AND d.objsubid = a.attnum
        LEFT JOIN ix ON ix.column_name = c.column_name
        WHERE c.table_schema = 'public' AND c.table_name = ${quoteLit(table)}
        ORDER BY c.ordinal_position
    `),

    fromField: (row) => ({
        name:       row.column_name,
        prop:       schemaFromField(row),
        isRequired: row.is_nullable === 'NO',
    }),
}

export const schemaFromDb = (query) => _schemaFromDb(query, dialect)
