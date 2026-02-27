
export const $item = Symbol('item.js [proxy target]');

const proxyHandler = {
    get: function (target, property, receiver) {
        const targetItem = target.item;
        if (property === $item) return targetItem;
        if (property === Symbol.iterator) {
            return function* () {
                for (const childItem of targetItem) {
                    yield toProxy(childItem);
                }
            };
        }
        if (typeof property === 'symbol') {
            if (typeof targetItem[property] === 'function') return targetItem[property].bind(targetItem);
            return Reflect.get(targetItem, property, receiver);
        }
        const childItem = targetItem.item(property);

        if (property === 'then') console.error('item.js: Proxy is not a Promise. Use `await proxy.bald()` instead of `await proxy`');
        if (property === 'toJSON') console.error('item.js: toJSON accessed on proxy. Use `JSON.stringify(proxy())` instead of `JSON.stringify(proxy)`');

        return toProxy(childItem);
    },

    set: function (target, property, value) {
        target.item.item(property).set(value);
        return true;
    },

    apply: function (target, thisArg, args) {
        const targetItem = target.item;
        if (args.length === 0) return targetItem.pending ? targetItem.promise : targetItem.get();
        if (args.length === 1) return targetItem.set(args[0]) ?? true;
        throw new Error('apply called with too many arguments');
    },

    has: (target, property) => target.item.has(property),

    ownKeys: (target) => target.item.keys,

    getOwnPropertyDescriptor(target, property) {
        if (typeof property === 'symbol') return Reflect.getOwnPropertyDescriptor(target.item, property);
        if (target.item.has(property)) {
            return {
                configurable: true,
                enumerable: true,
                writable: false
            };
        }
    },

    deleteProperty: function (target, property) {
        target.item.item(property).remove();
        return true;
    },
};

const cachedProxies = new WeakMap();

export const toProxy = (itm) => {
    if (!cachedProxies.has(itm)) {
        const fn = () => { };
        fn.item = itm;
        cachedProxies.set(itm, new Proxy(fn, proxyHandler));
    }
    return cachedProxies.get(itm);
};