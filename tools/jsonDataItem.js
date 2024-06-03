import { item } from '../item.js';

export async function jsonDataItem(jsonItem) {

    const root = item();
    const json = await jsonItem.value;

    if (json === undefined) {
        root.set(null)
    } else {
        try {
            root.set(JSON.parse(json));
        } catch (e) {
            console.error('jsonDataItem: invalid JSON', e);
            root.set(null);
        }
    }

    let timeout = null; // debounced
    root.addEventListener('changeIn', () => {
        if (timeout) return;
        timeout = setTimeout(() => {
            clearTimeout(timeout);
            timeout = null;
            jsonItem.value = JSON.stringify(root.value, null, 2);
        },1);
    });

    jsonItem.addEventListener('change', async () => { // changes from outside
        const json = await jsonItem.value;
        root.value = JSON.parse(json);
    });
    return root;
}
