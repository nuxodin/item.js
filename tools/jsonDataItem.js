import { item } from '../item.js';

export async function jsonDataItem(jsonItem) {
    const root = item();
    const syncFromJson = (json) => root.set(json ? JSON.parse(json) : null);    
    const syncToJson = () => jsonItem.set(JSON.stringify(root.value, null, 2));
    await jsonItem.read();
    syncFromJson(jsonItem.get());
    root.addEventListener('changeIn', debounce(syncToJson, 25));
    jsonItem.addEventListener('change', () => syncFromJson(jsonItem.value));
    return root;
}

export function bildJsonItem(raw, save, options = {}) {
    const root = item(JSON.parse(raw || "{}"));
    root.addEventListener("changeIn", debounce(() => save(JSON.stringify(root.get())), options.debounce ?? 25));
    return root;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
