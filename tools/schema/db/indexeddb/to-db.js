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

function indexOptions(table, name, prop) {
    if (prop['x-index'] === 'unique') return { unique: true }
    if (prop['x-index'] === true) return { unique: false }
    if (prop['x-index'] === 'fulltext')
        console.warn(`Skip fulltext index ${table}.${name}: IndexedDB has no native fulltext index`)
    return null
}

function sameKeyPath(a, b) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function sameIndex(index, opts) {
    return index.unique === opts.unique
}

async function schemaVersion(schema, dbName = 'default') {
    const buf  = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(stripMeta(schema))))
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
    const key  = 'idb-schema-versions:' + dbName
    const map  = JSON.parse(localStorage.getItem(key) || '{}')
    
    const vActual = Math.max(0, ...Object.values(map));
    const vStored = map?.[hash] ?? 0;

    if (!vStored || vActual > vStored) {
        map[hash] = vActual + 1
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

// tx = upgrade transaction from onupgradeneeded (e.target.transaction)
export function schemaToDb(schema, db, tx, { patch = false } = {}) {
    const tables = Object.keys(schema.properties ?? {})

    for (const table of tables) {
        const fields  = Object.entries(schema.properties[table]?.additionalProperties?.properties ?? {})
        const primaries = fields.filter(([, f]) => f['x-index'] === 'primary')
        const keyPath = primaries.length > 1 ? primaries.map(([n]) => n) : primaries[0]?.[0]

        if (!db.objectStoreNames.contains(table)) {
            const store = db.createObjectStore(table, {
                keyPath:       keyPath,
                autoIncrement: !!primaries[0]?.[1]?.['x-autoincrement'],
            })
            for (const [name, prop] of fields) {
                const opts = indexOptions(table, name, prop)
                if (opts) store.createIndex(name, name, opts)
            }
        } else {
            const store = tx.objectStore(table)
            if (!sameKeyPath(store.keyPath, keyPath) || store.autoIncrement !== !!primaries[0]?.[1]?.['x-autoincrement'])
                throw new Error(`IndexedDB objectStore ${table}: changing keyPath/autoIncrement requires a manual migration`)
            for (const [name, prop] of fields) {
                const opts = indexOptions(table, name, prop)
                if (!opts) continue
                if (store.indexNames.contains(name)) {
                    if (sameIndex(store.index(name), opts)) continue
                    store.deleteIndex(name)
                }
                store.createIndex(name, name, opts)
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
