import { Item } from '../item.js';

class StorageItem extends Item {
    $get() {
        return this.parent.nativeStorage.getItem(this.key) ?? '';
    }
    $set(value) {
        const str = (value == null) ? '' : String(value);
        this.parent.nativeStorage.setItem(this.key, str);
        super.$set(str);
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
        if (e.newValue === null) root.item(e.key).remove();
        else root.item(e.key).set(e.newValue);
    });
    return root;
}

export const local = createStore(localStorage);
export const session = createStore(sessionStorage);

export async function jsonItem(name, storage = local) {
    const { jsonDataItem } = await import('../tools/jsonDataItem.js');
    return await jsonDataItem(storage.item(name));
}