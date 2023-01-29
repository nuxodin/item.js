
export function syncWith(item, object={}) {
    item.addEventListener('changeIn', ({detail:{item}}) => {
        const keys = item.pathKeys;
        const lastKey = keys.pop();
        let current = object;
        keys.forEach(key => {
            if (key in current) current = current[key];
            else current = current[key] = {};
        });
        current[lastKey] = item.value;
    });
    return object;
}
