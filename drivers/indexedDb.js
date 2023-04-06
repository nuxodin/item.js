// alpha

import { item, Item } from '../item.js';
import { AsyncItem, AsyncChild } from '../tools/AsyncItem.js';
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7.1.1/with-async-ittr/+esm';


class Db extends Item {
    constructor(parent, key) {
        super(parent, key);
    }
    open(version, callbacks) {
        this.dbPromise = openDB(this.key, version, callbacks);
    }
    async loadItems() {
        const db = await this.dbPromise;
        for (const store of db.objectStoreNames) this.item(store);
    }

    ChildClass = Table;
}

class Table extends Item { // store

    // collect all changes in a batch
    _batchStack = null;
    _batch(callback) {
        if (this._batchStack) {
            this._batchStack.push(callback);
        } else {
            this._batchStack = [callback];
            this.parent.dbPromise.then( db => {
                const tx = db.transaction(this.key, 'readwrite');
                for (const callback of this._batchStack) {
                    try {
                        callback.resolve(callback(tx.store))
                    } catch (e) {
                        callback.reject(e);
                    }
                }
                this._batchStack = null;
            });
        }
        return new Promise((resolve, reject) => {
            callback.resolve = resolve;
            callback.reject = reject;
        });
    }
    async loadItems() {
        const store = await this.parent.dbPromise.then( db => db.transaction(this.key).store );
        for await (const cursor of store.iterate()) {
            this.item(cursor.key);
        }
    }

    #fields = null;
    #primaries = null;
    async fields() {
        if (!this.#fields) {

            const store = await this.parent.dbPromise.then( db => db.transaction(this.key).store );

            this.#fields = new Map();
            this.#primaries = new Map();

            if (store.keyPath) {
                let keys = store.keyPath;
                if (typeof keys === 'string') keys = [keys];
                for (const key of keys) {
                    const field = new Field(this, key);
                    field.primary = true;
                    field.autoIncrement = store.autoIncrement;
                    this.#fields.set(key, field);
                    this.#primaries.set(key, field);
                }
            }

            for (const key of store.indexNames) {
                this.#fields.set(key, new Field(this, key));
            }
        }
        return this.#fields;
    }
    async primaries() {
        if (!this.#primaries) await this.fields();
        return this.#primaries;
    }

    async field(name) {
        return (await this.fields()).get(name);
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
    toString(){ return this.name; }
}


class Cell extends AsyncChild {
    ChildClass = AsyncChild;
}


class Row extends AsyncItem {
    createGetter() {
        return this.parent._batch( store => store.get(this.key) );
    }
    createSetter(value) {
        return this.parent._batch( store => store.put(value) );
        //return this.parent._batch( store => store.put(value, this.key) ); // TODO: if the store has no inline key
    }
    remove() {
        this.parent._batch( store => store.delete(this.key) ).then( () => {
            super.remove();
        });
    }
    ChildClass = Cell;
}


let root = null; // cached, the item that stands for the root of all dbs
export function IDB(){
    if (!root) {
        root = item();
        root.ChildClass = Db;
    }
    return root;
}


// todo:
// dbPromise.clear('keyval');
// dbPromise.getAllKeys('keyval');
