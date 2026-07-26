// sqlite/to-db.js
// Note: SQLite cannot modify or drop columns — changes require table recreation
import { schemaFromDb, singleColumnIndexes } from './from-db.js'
import { toFieldDef }   from './to-field.js'
import { quoteId, schemaType } from '../shared/sql.js'
import { schemaDiff }   from '../../diff.js'

function tableFields(tableSchema) {
    return Object.entries(tableSchema.additionalProperties?.properties ?? {})
}

const indexName = (table, name) => `idx_${table}_${name}`

// SQLite: a single integer primary key must be declared inline as
// `INTEGER PRIMARY KEY [AUTOINCREMENT]`; AUTOINCREMENT is invalid elsewhere.
// Composite or non-integer keys use a table-level PRIMARY KEY constraint.
function createBody(fields, primaries) {
    const pkProp = fields.find(([n]) => n === primaries[0])?.[1]
    const soloInt = primaries.length === 1 && pkProp &&
        ['integer', 'boolean'].includes(schemaType(pkProp))
    const cols = fields.map(([n, f]) => {
        const isPk = soloInt && n === primaries[0]
        // Only `INTEGER PRIMARY KEY` is the rowid alias, and AUTOINCREMENT is legal nowhere else —
        // so a boolean key keeps the integer spelling, which SQLite would otherwise reject.
        let def = toFieldDef(n, isPk ? { ...f, type: 'integer' } : f)
        if (isPk) def += f['x-autoincrement'] ? ' PRIMARY KEY AUTOINCREMENT' : ' PRIMARY KEY'
        return '  ' + def
    }).join(',\n')
    const pk = (!soloInt && primaries.length) ? `,\n  PRIMARY KEY (${primaries.map(quoteId).join(', ')})` : ''
    return `${cols}${pk}`
}

function indexKind(table, name, prop) {
    if (prop['x-index'] === 'unique') return 'UNIQUE INDEX'
    if (prop['x-index'] === true) return 'INDEX'
    if (prop['x-index'] === 'fulltext')
        console.warn(`Skip FULLTEXT INDEX ${table}.${name}: SQLite fulltext requires a virtual FTS table`)
    return null
}

function createIndex(table, name, kind) {
    return `CREATE ${kind} ${quoteId(indexName(table, name))} ON ${quoteId(table)} (${quoteId(name)});`
}

function indexStatements(table, fields, primaries, current = [], { patch = false } = {}) {
    const stmts = [], wanted = new Set()
    for (const [name, prop] of fields) {
        if (primaries.includes(name)) continue
        const kind = indexKind(table, name, prop)
        if (!kind) continue
        const idx = indexName(table, name), unique = kind === 'UNIQUE INDEX'
        const curr = current.find(i => i.name === idx) ?? current.find(i => i.column === name && i.unique === unique)
        wanted.add(idx)
        if (curr && curr.column === name && curr.unique === unique) continue
        if (curr?.name === idx) stmts.push(`DROP INDEX ${quoteId(curr.name)};`)
        stmts.push(createIndex(table, name, kind))
    }
    if (!patch) {
        for (const curr of current) {
            if (curr.name.startsWith(`idx_${table}_`) && !wanted.has(curr.name))
                stmts.push(`DROP INDEX ${quoteId(curr.name)};`)
        }
    }
    return stmts
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
            stmts.push(`CREATE TABLE ${quoteId(table)} (\n${createBody(fields, primaries)}\n);`)
            stmts.push(...indexStatements(table, fields, primaries))
        } else {
            const currFields = Object.keys(current.properties[table]?.additionalProperties?.properties ?? {})
            const hasChanges = diffs.some(d => d.path[0] === 'properties' && d.path[1] === table)
            const hasDrops   = !patch && currFields.some(n => !fields.find(([fn]) => fn === n))

            if (hasChanges && (hasDrops || !patch)) {
                const tmp      = `${table}_migration_tmp`
                const keep     = fields.map(([n]) => n).filter(n => currFields.includes(n))
                const colsList = keep.map(quoteId).join(', ')

                stmts.push(`CREATE TABLE ${quoteId(tmp)} (\n${createBody(fields, primaries)}\n);`)
                if (keep.length) stmts.push(`INSERT INTO ${quoteId(tmp)} (${colsList}) SELECT ${colsList} FROM ${quoteId(table)};`)
                stmts.push(`DROP TABLE ${quoteId(table)};`)
                stmts.push(`ALTER TABLE ${quoteId(tmp)} RENAME TO ${quoteId(table)};`)
                stmts.push(...indexStatements(table, fields, primaries))
            } else {
                for (const [name, prop] of fields) {
                    if (!currFields.includes(name))
                        stmts.push(`ALTER TABLE ${quoteId(table)} ADD COLUMN ${toFieldDef(name, prop)};`)
                }
                stmts.push(...indexStatements(table, fields, primaries, await singleColumnIndexes(query, table), { patch }))
            }
        }
    }

    if (!patch) {
        for (const table of currTables) {
            if (!nextTables.includes(table))
                stmts.push(`DROP TABLE ${quoteId(table)};`)
        }
    }

    for (const stmt of stmts) {
        console.log(stmt)
        await query(stmt)
    }
    return { diffs, executed: stmts }
}
