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
}


let root = null; // cached
export function IDB(){
    if (!root) {
        root = item();
        root.ChildClass = IDB_db;
    }
    return root;
}

// const dbPromise = openDB('keyval-store', 1, {
//   upgrade(db) {
//     db.createObjectStore('keyval');
//   },
// });
// export async function del(key) {
//   return (await dbPromise).delete('keyval', key);
// }
// export async function clear() {
//   return (await dbPromise).clear('keyval');
// }
// export async function keys() {
//   return (await dbPromise).getAllKeys('keyval');
// }