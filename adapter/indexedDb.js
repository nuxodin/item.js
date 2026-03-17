// @ts-check

import { Item, item } from "../item.js";
import { AsyncChild } from "../tools/AsyncChild.js";

import * as idb from "https://cdn.jsdelivr.net/npm/idb@7.1.1/with-async-ittr/+esm";
import { openDb } from "../tools/schema/db/indexeddb/to-db.js";

class Db extends Item {
    open({ version = null, patch = true, upgrade = null } = {}) {
        this.dbPromise = openDb(this.key, this.schema, {
            version,
            patch,
            upgrade,
        }).then(idb.wrap);
    }

    async reader() {
        const db = await this.dbPromise;
        for (const store of db.objectStoreNames) this.item(store);
    }
    ChildClass = Table;
}

class Table extends Item { // store
    _batchQueue = [];
    _batchRunning = false;

    async _batch(fn) {
        return new Promise((resolve, reject) => {
            this._batchQueue.push({ fn, resolve, reject });
            this._runBatch();
        });
    }
    async _runBatch() {
        if (this._batchRunning) return;
        this._batchRunning = true;
        const store = await this.store(true);
        for (const job of this._batchQueue) {
            try { job.resolve(job.fn(store)); }
            catch (e) { job.reject(e); }
        }
        this._batchQueue = [];
        this._batchRunning = false;
    }

    async store(readwrite = false){
        const db = await this.parent.dbPromise;
        return db.transaction(this.key, readwrite ? "readwrite" : "readonly").store;
    }

    async reader() {
        const store = await this.store();
        for (const key of await store.getAllKeys()) {
            const item = this.item(key);
            item.typedKey = key;
        }
    }

    async adder(values) {
        const store = await this.store(true);
        const key = (!store.autoIncrement && !store.keyPath)
            ? crypto.randomUUID()
            : undefined;
        const result = await store.add(values, key);
        return { key: result };
    }

    #fields = null;
    #primaries = null;

    fields() {
        if (!this.#fields) {
            this.#fields = new Map();
            this.#primaries = new Map();

            const schemaProps = this.schema?.additionalProperties?.properties;

            if (schemaProps) {
                // aus Schema lesen
                for (const [name, prop] of Object.entries(schemaProps)) {
                    const field = new Field(this, name);
                    field.primary = prop["x-index"] === "primary";
                    field.autoIncrement = !!prop["x-autoincrement"];
                    this.#fields.set(name, field);
                    if (field.primary) this.#primaries.set(name, field);
                }
            } else {
                console.log("no scheme for table", this.key);
                // fields() should not be async
                // // Fallback: aus DB auslesen
                // const store = await this.store();
                // if (store.keyPath) {
                //     let keys = store.keyPath
                //     if (typeof keys === 'string') keys = [keys]
                //     for (const key of keys) {
                //         const field = new Field(this, key)
                //         field.primary = true
                //         field.autoIncrement = store.autoIncrement
                //         this.#fields.set(key, field)
                //         this.#primaries.set(key, field)
                //     }
                // }
                // for (const key of store.indexNames) {
                //     this.#fields.set(key, new Field(this, key))
                // }
            }
        }
        return this.#fields;
    }

    async primaries() {
        if (!this.#primaries) this.fields();
        return this.#primaries;
    }

    async field(name) {
        return (this.fields()).get(name);
    }

    ChildClass = Row;
}

class Field {
    constructor(table, name) {
        this.name = name;
        this.table = table;
        this.db = table.parent;
    }
    primary = false;
    autoIncrement = false;
    toString() { return this.name; }
}

class Row extends Item {
    async reader() {
        const key = this.getTypedKey();
        const data = await this.parent._batch((store) => store.get(key));
        this.set(data, { local: true });
    }
    writer(value) {
        const key = this.getTypedKey();
        return this.parent._batch((store) => store.put(value), key);
    }
    remover() {
        const key = this.getTypedKey();
        return this.parent._batch((store) => store.delete(key));
    }
    getTypedKey() {
        if ('typedKey' in this) return this.typedKey;
        const isAutoincrement = Object.values(this.schema?.properties ?? {}).find(field => field['x-autoincrement'] === true);
        this.typedKey = isAutoincrement ? Number(this.key) : this.key;
        return this.typedKey;
    }
    ChildClass = AsyncChild;
}

let root = null;
root = item();
root.ChildClass = Db;

export const iDB = root;

export function IDB() {
    console.warn("IDB() is deprecated, use idb instead");
    return root;
}
