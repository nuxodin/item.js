import {Item} from '../item.js';

let cached = null;
export function localStorageItem(){
    if (!cached) {
        const root = new Item();
        addEventListener('storage', e => {
            root.item(e.key).value = e.newValue;
        });
        root.addEventListener('setIn', ({detail}) => {
            const item = detail.item;
            localStorage.setItem(item.key, detail.newValue);
        });
        root.addEventListener('getIn', ({detail}) => {
            const item = detail.item;
            item.value = localStorage.getItem(item.key);
        });
        cached = root;
    }
    return cached;
}
