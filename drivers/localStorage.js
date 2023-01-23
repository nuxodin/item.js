import {Item} from '../item.js';

let root = null; // cached
export function localStorageItem(){
    if (!root) {
        root = new Item();
        addEventListener('storage', e => {
            root.item(e.key).value = e.newValue;
        });
        root.addEventListener('setIn', ({detail}) => {
            localStorage.setItem(detail.item.key, detail.newValue);
        });
        root.addEventListener('getIn', ({detail}) => {
            detail.item.value = localStorage.getItem(detail.item.key);
        });
    }
    return root;
}
