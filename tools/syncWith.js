// beta, subject to change or deleted

export function syncWith(rootItem, object={}) {
    rootItem.addEventListener('changeIn', ({target, detail}) => {
        if (!('value' in detail)) return;
        const keys = target.path;
        const lastKey = keys.pop();
        let current = object;
        keys.forEach(key => {
            if (!isObject(current[key])) {
                current[key] = Object.create(null);
            }
            current = current[key];
        });
        current[lastKey] = target.value; // await if promise?
    });
    return object;
}

function isObject(obj) {
    return obj === Object(obj);
}