// sqlite/to-db.js
// Note: SQLite cannot modify or drop columns — changes require table recreation
import { schemaFromDb } from './from-db.js'
import { toFieldDef }   from './to-field.js'
import { schemaDiff }   from '../../diff.js'

function tableFields(tableSchema) {
    return Object.entries(tableSchema.additionalProperties?.properties ?? {})
}

export async function schemaToDb(schema, query, { force = false, patch = false } = {}) {
    const current = await schemaFromDb(query)
    const diffs   = schemaDiff(schema, current)

    if (!patch) {
        const destructive = diffs.filter(d => d.destructive === true)
        if (destructive.length && !force) {
            const msgs = destructive.map(d => `  ${d.path.join('.')} — ${d.msg}`).join('\n')
            throw new Error(`Destructive schema changes detected (use force to apply):\n${msgs}`)
        }
    }

    const stmts      = []
    const nextTables = Object.keys(schema.properties ?? {})
    const currTables = Object.keys(current.properties ?? {})

    for (const table of nextTables) {
        const fields    = tableFields(schema.properties[table])
        const primaries = fields.filter(([, f]) => f['x-index'] === 'primary').map(([n]) => n)

        if (!currTables.includes(table)) {
            const cols = fields.map(([n, f]) => '  ' + toFieldDef(n, f)).join(',\n')
            const pk   = primaries.length ? `,\n  PRIMARY KEY (${primaries.map(n => `\`${n}\``).join(', ')})` : ''
            stmts.push(`CREATE TABLE \`${table}\` (\n${cols}${pk}\n);`)
        } else {
            const currFields = Object.keys(current.properties[table]?.additionalProperties?.properties ?? {})
            const hasChanges = diffs.some(d => d.path[0] === table)
            const hasDrops   = !patch && currFields.some(n => !fields.find(([fn]) => fn === n))

            if (hasChanges && (hasDrops || !patch)) {
                const tmp      = `${table}_migration_tmp`
                const cols     = fields.map(([n, f]) => '  ' + toFieldDef(n, f)).join(',\n')
                const pk       = primaries.length ? `,\n  PRIMARY KEY (${primaries.map(n => `\`${n}\``).join(', ')})` : ''
                const keep     = fields.map(([n]) => n).filter(n => currFields.includes(n))
                const colsList = keep.map(n => `\`${n}\``).join(', ')

                stmts.push(`CREATE TABLE \`${tmp}\` (\n${cols}${pk}\n);`)
                stmts.push(`INSERT INTO \`${tmp}\` (${colsList}) SELECT ${colsList} FROM \`${table}\`;`)
                stmts.push(`DROP TABLE \`${table}\`;`)
                stmts.push(`ALTER TABLE \`${tmp}\` RENAME TO \`${table}\`;`)
            } else {
                for (const [name, prop] of fields) {
                    if (!currFields.includes(name))
                        stmts.push(`ALTER TABLE \`${table}\` ADD COLUMN ${toFieldDef(name, prop)};`)
                }
            }
        }
    }

    if (!patch) {
        for (const table of currTables) {
            if (!nextTables.includes(table))
                stmts.push(`DROP TABLE \`${table}\`;`)
        }
    }

    for (const stmt of stmts) await query(stmt)
    return { diffs, executed: stmts }
}