import { Item } from '../item.js';

class StorageItem extends Item {
    $get() {
        return this.parent.nativeStorage.getItem(this.key) ?? '';
    }
    $set(value) {
        this.parent.nativeStorage.setItem(this.key, String(value));
        super.$set(String(value));
    }
    remove() {
        this.parent.nativeStorage.removeItem(this.key);
        super.remove();
    }
    static ChildClass = false;
}

function createStore(nativeStorage) {
    const root = new Item();
    root.nativeStorage = nativeStorage;
    root.ChildClass = StorageItem;
    root.reader = () => {
        for (let i = 0; i < nativeStorage.length; i++) root.item(nativeStorage.key(i));
    };
    addEventListener('storage', e => {
        if (e.storageArea !== nativeStorage) return;
        root.item(e.key).io.setLocal(e.newValue);
    });
    return root;
}

export const local = createStore(localStorage);
export const session = createStore(sessionStorage);

export async function jsonItem(name, storage = local) {
    const { jsonDataItem } = await import('../tools/jsonDataItem.js');
    return await jsonDataItem(storage.item(name));
}