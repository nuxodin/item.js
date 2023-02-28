import { item } from '../item.js';

export async function jsonDataItem(jsonItem) {
    const root = item();
    root.value = JSON.parse(await jsonItem.value); // initial value
    root.addEventListener('changeIn', () => {
        jsonItem.value = JSON.stringify(root.value, null, 2);
    });
    jsonItem.addEventListener('change', async () => { // changes from outside
        const value = await jsonItem.value;
        root.value = JSON.parse(value);
    });
    return root;
}
