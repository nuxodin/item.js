import {item} from '../item.js';

let root = null; // cached
export function localStorageItem(){
    if (!root) {
        root = item();
        root.addEventListener('setIn', ({detail}) => {
            localStorage.setItem(detail.item.key, detail.value);
        });
        root.addEventListener('getIn', ({detail:{item}}) => {
            if (item.filled) return; // use cached value
            item.value = localStorage.getItem(item.key);
        });
        addEventListener('storage', e => { // does not trigger on source window!
            root.item(e.key).value = e.newValue;
        });
    }
    return root;
}
