// alpha

import { item, Item } from '../item.js';
import { AsyncItem } from '../tools/AsyncItem.js';
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7.1.1/with-async-ittr/+esm';


class IDB_db extends Item {
    ChildClass = IDB_store;
    constructor(parent, key) {
        super(parent, key);
    }
    open(version, callbacks) {
        this.dbPromise = openDB(this.key, version, callbacks);
    }
    async loadAll() {
        const db = await this.dbPromise;
        for (const store of db.objectStoreNames) {
            this.item(store);
        }
    }

    static isPrimitive(){ return false; }
}

class IDB_store extends Item {
    ChildClass = IDB_entry;
    static isPrimitive(){ return false; }

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
    async loadAll() {
        const store = await this.parent.dbPromise.then( db => db.transaction(this.key).store );
        for await (const cursor of store.iterate()) {
            this.item(cursor.key);
        }
    }
}

class IDB_entry extends AsyncItem {
    static isPrimitive(){ return false; } // needed?

    createGetter() {
        return this.parent._batch( store => store.get(this.key) );
    }
    createSetter(value) {
        return this.parent._batch( store => store.put(value, this.key) );
    }
    remove() {
        this.parent._batch( store => store.delete(this.key) ).then( () => {
            super.remove();
        });
    }
    ChildClass = Item;
}


let root = null; // cached, the item that stands for the root of all dbs
export function IDB(){
    if (!root) {
        root = item();
        root.ChildClass = IDB_db;
    }
    return root;
}


// todo:
// dbPromise.delete('keyval', key);
// dbPromise.clear('keyval');
// dbPromise.getAllKeys('keyval');
