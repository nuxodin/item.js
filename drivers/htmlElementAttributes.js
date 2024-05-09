import { Item, item } from '../item.js';


// todo, weakmap for caching?
const all = new WeakMap();

export function attributes(element) {

    if (all.has(element)) return all.get(element);    

    const root = item();

    all.set(element, root);

    root.ChildClass = AttributeItem;

    // initial data
    for (const attr of element.attributes) {
        root.item(attr.name).set(attr.value);
    }

    // dom changes
    new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                if (mutation.target !== element) console.error('what?');
                const name = mutation.attributeName;
                const value = element.getAttribute(name);
                value === null ? root.item(name).remove() : root.item(name).set(value);
            }
        }
    }).observe(element, { attributes: true });

    // item changes
    root.addEventListener('changeIn', ({detail}) => {
        if (detail.add) return;
        if (detail.remove) {
            element.removeAttribute(detail.remove.key);
            return;
        }
        if (detail.item.parent === root) {
            element.setAttribute(detail.item.key, detail.value);
            return;
        }
        console.error('what?');
    });

    return root;
}    

class AttributeItem extends Item {
    constructor(root, key) {
        super(root, key);
    }
    $set(value) {
        super.$set(String(value));
    }
    ChildClass = false;
}