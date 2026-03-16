// indexeddb/to-db.js

const STRUCTURAL = new Set([
    'properties',
    'additionalProperties',
    'x-index',
    'x-autoincrement',
])

function stripMeta(v, keepKeys = false) {
    if (Array.isArray(v)) return v.map(x => stripMeta(x))
    if (v !== null && typeof v === 'object') {
        const entries = keepKeys ? Object.entries(v) : Object.entries(v).filter(([k]) => STRUCTURAL.has(k))
        return Object.fromEntries(entries.map(([k, val]) => [k, stripMeta(val, k === 'properties')]))
    }
    return v
}

async function schemaVersion(schema, dbName = 'default') {
    const buf  = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(stripMeta(schema))))
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
    const key  = 'idb-schema-versions:' + dbName
    const map  = JSON.parse(localStorage.getItem(key) || '{}')
    if (!map[hash]) {
        map[hash] = Math.max(0, ...Object.values(map)) + 1
        localStorage.setItem(key, JSON.stringify(map))
    }
    return map[hash]
}

/**
 * @param {string} name
 * @param {object|null} schema
 * @param {object} [options]
 * @param {number|null} [options.version=null]
 * @param {boolean} [options.patch=true]
 * @param {function|null} [options.upgrade=null] - Called in onupgradeneeded after schema migration. (e: IDBVersionChangeEvent) => void
 */
export async function openDb(name, schema, { patch = true, version = null, upgrade = null } = {}) {
    if (upgrade && version == null) throw new Error('openDb: "upgrade" requires a manual "version"')
    if (version == null && schema) version = await schemaVersion(schema, name);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(name, version);
        req.onupgradeneeded = (e) => {
            if (schema) schemaToDb(schema, e.target.result, e.target.transaction, { patch });
            upgrade?.(e)
        }
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    })
}
// export async function openDb(name, schema, { patch = true } = {}) {
//     const version = await schemaVersion(schema, name)
//     return new Promise((resolve, reject) => {
//         const req = indexedDB.open(name, version)
//         req.onupgradeneeded = (e) => {
//             const db = e.target.result
//             const tx = e.target.transaction
//             schemaToDb(schema, db, tx, { patch })
//         }
//         req.onsuccess = (e) => resolve(e.target.result)
//         req.onerror   = (e) => reject(e.target.error)
//     })
// }

// tx = upgrade transaction from onupgradeneeded (e.target.transaction)
export function schemaToDb(schema, db, tx, { patch = false } = {}) {
    const tables = Object.keys(schema.properties ?? {})

    for (const table of tables) {
        const fields  = Object.entries(schema.properties[table]?.additionalProperties?.properties ?? {})
        const primary = fields.find(([, f]) => f['x-index'] === 'primary')

        if (!db.objectStoreNames.contains(table)) {
            const store = db.createObjectStore(table, {
                keyPath:       primary?.[0] ?? 'id',
                autoIncrement: !!primary?.[1]?.['x-autoincrement'],
            })
            for (const [name, prop] of fields) {
                if (prop['x-index'] === 'unique') store.createIndex(name, name, { unique: true })
                else if (prop['x-index'] === true) store.createIndex(name, name, { unique: false })
            }
        } else {
            const store = tx.objectStore(table)
            for (const [name, prop] of fields) {
                if (!store.indexNames.contains(name) && prop['x-index'])
                    store.createIndex(name, name, { unique: prop['x-index'] === 'unique' })
            }
            if (!patch) {
                for (const name of Array.from(store.indexNames))
                    if (!fields.find(([n]) => n === name)) store.deleteIndex(name)
            }
        }
    }

    if (!patch) {
        for (const name of Array.from(db.objectStoreNames))
            if (!tables.includes(name)) db.deleteObjectStore(name)
    }
}