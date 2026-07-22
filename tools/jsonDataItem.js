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

/** JSON-backed root item: every write in the tree persists the whole document.
 *  `set()`/`patch()` return a promise — await it when the write must have landed. */
export function bildJsonItem(raw, save, options = {}) {
    const root = item(JSON.parse(raw || "{}"));
    root.writer = v => save(JSON.stringify(v));
    root.io.options.debounceMs = options.debounce ?? 25;
    return root;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
