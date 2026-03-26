// beta, subject to change or deleted

export function syncWith(rootItem, object={}) {
    rootItem.addEventListener('changeIn', event => {
        if (!('value' in event)) return;
        const keys = [...event.target.path];
        const lastKey = keys.pop();
        let current = object;
        keys.forEach(key => {
            if (!isObject(current[key])) {
                current[key] = Object.create(null);
            }
            current = current[key];
        });
        current[lastKey] = event.target.value;
    });
    return object;
}

function isObject(obj) {
    return obj === Object(obj);
}