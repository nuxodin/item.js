
export function syncWith(item, object={}) {
    item.addEventListener('changeIn', ({detail}) => {
        const item = detail.item;
        if (!('value' in detail)) return;
        const keys = item.pathKeys;
        const lastKey = keys.pop();
        let current = object;
        keys.forEach(key => {
            if (!isObject(current[key])) {
                current[key] = Object.create(null);
            }
            current = current[key];
        });
        current[lastKey] = item.value; // await if promise?
    });
    return object;
}

function isObject(obj) {
    return obj === Object(obj);
}