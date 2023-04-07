import { item } from '../item.js';

export async function jsonDataItem(jsonItem) {

    const root = item();
    const json = await jsonItem.value;

    root.value = json === undefined ? null : JSON.parse(json);

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
