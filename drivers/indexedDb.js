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
    // async allStores() { // works needed?
    //     const db = await this.dbPromise;
    //     const result = Object.create(null);
    //     for (const name of db.objectStoreNames) {
    //         result[name] = this.item(name);
    //     }
    //     return result;
    // }
    static isPrimitive(){ return false; }
}

class IDB_store extends Item {
    ChildClass = IDB_entry;
    static isPrimitive(){ return false; }
}

class IDB_entry extends AsyncItem {
    createGetter() {
        const store = this.parent;
        const db = store.parent;
        return db.dbPromise.then( db => db.get(store.key, this.key) );
    }
    createSetter(value) {
        const store = this.parent;
        const db = store.parent;
        return db.dbPromise.then( db => db.put(store.key, value, this.key) );
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
