import {item} from '../item.js';

let root = null; // cached
export function getStore(){
    if (!root) {
        root = item();
        root.addEventListener('changeIn', ({detail}) => {
            if (detail.item === root) return; // ignore root change (add and remove items)
            localStorage.setItem(detail.item.key, detail.value);
        });
        root.addEventListener('getIn', ({detail:{item}}) => {
            if (item.filled) return; // use cached value
            item.value = localStorage.getItem(item.key) ?? ''; // ?? '' to avoid null, is this god or is it needed to be able to check if the item exists?
        });
        addEventListener('storage', e => { // does not trigger on source window!
            root.item(e.key).value = e.newValue;
        });
        root.loadItems = function(){
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                root.item(key);
            }
        }
    }
    return root;
}

export async function jsonItem(name) {
    const {jsonDataItem} = await import('../tools/jsonDataItem.js');
    return await jsonDataItem( getStore().item(name) );
}
