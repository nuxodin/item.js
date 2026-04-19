
export const $item = Symbol('item.js [proxy target]');

const proxyHandler = {

    get: function (target, property) {
        const targetItem = target.item;
        if (property === $item) return targetItem;
        if (property === Symbol.iterator) {
            !targetItem.filled && targetItem.read(); // read?
            return function* () {
                for (const childItem of targetItem) yield toProxy(childItem);
            };
        }
        if (typeof property === 'symbol') {
            if (typeof targetItem[property] === 'function') return targetItem[property].bind(targetItem);
            return targetItem[property];
        }


        if (property === 'then') {
            // console.log('beta: proxy item as thenable');
            return (resolve, reject) => {
                targetItem.read()
                    .then(() => resolve(targetItem.get())) 
                    .catch(reject);
            };
        }
    
        const childItem = targetItem.item(property);

//        if (property === 'then') console.error('item.js: Proxy is not a Promise. Use `await proxy.item()` instead of `await proxy`');
        if (property === 'toJSON') console.error('item.js: toJSON accessed on proxy. Use `JSON.stringify(proxy())` instead of `JSON.stringify(proxy)`');

        return toProxy(childItem);
    },

    set: function (target, property, value) {
        target.item.item(property).set(value);
        return true;
    },

    apply: function (target, thisArg, args) {
        const targetItem = target.item;
        if (args.length === 0) {
            return targetItem.get();
            // return targetItem.read().then(() => targetItem.get());
            // return targetItem.get();
            // return new Promise((resolve, reject) => {
            //     //if (targetItem.filled) return resolve(targetItem.get());
            //     targetItem.read().then(() => resolve(targetItem.get())).catch(reject);
            // });
            // if (!targetItem.filled) targetItem.read();
        }
        if (args.length === 1) return targetItem.set(args[0]) ?? true;
        throw new Error('apply called with too many arguments');
    },

    has: (target, property) => typeof property === 'string' && !!target.item.has(property),

    ownKeys: (target) => {
        if (!target.item.filled) target.item.read();
        return target.item.keys;
    },

    getOwnPropertyDescriptor(target, property) {
        if (typeof property === 'symbol') return Reflect.getOwnPropertyDescriptor(target.item, property);
        if (target.item.has(property)) return { configurable: true, enumerable: true, writable: false };
    },

    deleteProperty: function (target, property) {
        target.item.has(property)?.remove();
        return true;
    },
};

const cachedProxies = new WeakMap();

export const toProxy = (itm) => {
    let p = cachedProxies.get(itm);
    if (!p) {
        const fn = ()=>{};
        fn.item = itm;
        p = new Proxy(fn, proxyHandler);
        cachedProxies.set(itm, p);
    }
    return p;
};