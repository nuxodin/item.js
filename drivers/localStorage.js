import {item} from '../item.js';

let root = null; // cached
export function localStorageItem(){
    if (!root) {
        root = item();
        addEventListener('storage', e => {
            root.item(e.key).value = e.value;
        });
        root.addEventListener('setIn', ({detail}) => {
            localStorage.setItem(detail.item.key, detail.value);
        });
        root.addEventListener('getIn', ({detail}) => {
            detail.returnValue = localStorage.getItem(detail.item.key);
        });
    }
    return root;
}
