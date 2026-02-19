import { item } from '../item.js';

export async function jsonDataItem(jsonItem) {
    const root = item();
    
    const syncFromJson = (json) => {
        if (!json) {
            root.set(null);
            return;
        }
        root.set(JSON.parse(json));
    };
    
    const syncToJson = () => {
        jsonItem.value = JSON.stringify(root.value, null, 2);
    };
    
    // Initial sync from file
    syncFromJson(await jsonItem.promise);
    
    // Sync root changes to file (debounced)
    let debounceTimer = null;
    root.addEventListener('changeIn', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(syncToJson, 1);
    });
    
    // Sync file changes to root
    jsonItem.addEventListener('change', async () => {
        syncFromJson(await jsonItem.promise);
    });
    
    return root;
}