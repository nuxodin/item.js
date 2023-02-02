import { item } from '../item.js';
import { AsyncItem } from '../tools/AsyncItem.js';

class CookieItem extends AsyncItem {
    createGetter() {
        return cookieStore.get(this.key).then( data => data?.value ?? '' );
    }
    createSetter(value) {
        return cookieStore.set({ // triggers store-change
            name: this.key,
            value,
            //expires: Date.now() + day,
            //domain: "example.com",
        });
    }
    $set(value){
        super.$set(String(value));
    }
}

let root = null; // cached

export function cookies(){
    if (!root) {
        root = item();
        root.ChildClass = CookieItem;
        root.getAll = async function(options) {
            const result = Object.create(null);
            await cookieStore.getAll(options).then( cookies => {
                cookies.forEach(c => {
                    const item = root.item(c.name)
                    item.master.setFromMaster(c.value);
                    result[c.name] = item;
                });
            });
            return result;
        };

        cookieStore.addEventListener?.('change', e => { // todo: if two windows open, this will trigger twice
            e.changed.forEach(c => {
                //if (!root.has(c.name)) return;
                root.item(c.name).master.setFromMaster(c.value); // triggers item change
            });
        });

    }
    return root;
}