// indexeddb/from-db.js
import { schemaFromDb as _schemaFromDb } from '../shared/from-db.js'

const dialect = {
    tables: (db) => Array.from(db.objectStoreNames),

    fields: (db, table) => {
        const store = db.transaction(table).objectStore(table)
        const fields = []
        const keyPath = Array.isArray(store.keyPath) ? store.keyPath[0] : store.keyPath
        if (keyPath) fields.push({ name: keyPath, isPrimary: true, autoIncrement: store.autoIncrement })
        for (const name of store.indexNames) {
            const idx = store.index(name)
            fields.push({ name, isUnique: idx.unique, isMultiEntry: idx.multiEntry })
        }
        return fields
    },

    fromField: (col) => {
        const prop = {}
        if (col.isPrimary)     prop['x-index']       = 'primary'
        if (col.isUnique)      prop['x-index']       = 'unique'
        if (col.isMultiEntry)  prop['x-multientry']  = true
        if (col.autoIncrement) prop['x-autoincrement'] = true
        // no type info available — IndexedDB is schemaless
        return { name: col.name, prop, isRequired: !!col.isPrimary }
    },
}

export const schemaFromDb = (db) => _schemaFromDb(db, dialect)