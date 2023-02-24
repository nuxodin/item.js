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
    _batch
    static isPrimitive(){ return false; }
}



// let batchStack = null;
// function batch(callback) {
//     if (batchStack) {
//         batchStack.push(callback);
//     } else {
//         batchStack = [callback];
//         queueMicrotask( () => {
//             const connection = connect();
//             for (const callback of batchStack) {
//                 callback.resolve(callback(connection));
//             }
//             batchStack = null;
//         });
//     }
//     return new Promise((resolveFn) => {
//         callback.resolve = resolveFn;
//     });
// }

// // ussage:
// const [foo, bar] = Promise.all([
//     batch(connection=>connection.get('foo')),
//     batch(connection=>connection.get('bar')),
// ]);



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
}

class IDB_entry extends AsyncItem {
    static isPrimitive(){ return false; } // needed?

    createGetter() {
        return this.parent._batch( store => store.get(this.key) );
    }
    createSetter(value) {
        return this.parent._batch( store => store.put(value, this.key) );
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
