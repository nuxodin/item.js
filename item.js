
/**
 * Class representing an item.
 * @extends EventTarget
 */
export class Item extends EventTarget {

    #value;
    #parent;
    #key;
    #isObject = null; // null means not filled, true means filled with an object, false means filled with a primitive value
    #isGetting = false;
    #isSetting = false;

    constructor(parent, key) {
        super();
        this.#parent = parent;
        this.#key = key;
        this.addEventListener('change', () => triggerEffectsFor(this)); // the method that triggers the change effect can be overwritten by a child class, therefore we use the event
    }

    get key() { return this.#key }
    get parent() { return this.#parent }
    get filled() { return this.#isObject !== null; }

    set value(value) { this.set(value); }
    get value() { return this.get(); }

    get() {
        if (this.#isGetting) throw new Error('circular get');
        this.#isGetting = true;
        dispatchEvent(this, 'get', { item: this, value: this.#value });
        registerCurrentEffectFor(this);
        this.#isGetting = false;
        return this.$get();
    }
    set(value, options = {}) {
        if (this.#isSetting) throw new Error('circular set');
        this.#isSetting = true;
        const obj = dispatchEvent(this, 'set', { item: this, oldValue: this.#value, value, options });
        const result = !obj.defaultPrevented ? this.$set(value, options) : null;
        this.#isSetting = false;
        return result;
    }
    patch(value) {
        this.set(value, { patch: true });
    }

    $get() {
        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            const value = this.#value ??= Object.create(null); // if undefined, create object
            return Object.fromEntries(Object.entries(value).map(([key, { value }]) => [key, value]));
        }
    }
    $set(value, options) {
        const oldValue = this.#value;

        if (this.constructor.isPrimitive(value)) {
            if (this.#isObject !== false || !this.constructor.equals(oldValue, value)) {
                this.#value = value;
                this.#isObject = false;
                if (!this.#isGetting) {
                    dispatchEvent(this, 'change', { item: this, oldValue, value });
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            const entries = Object.entries(value);
            if (!this.#isObject) {
                this.#value = Object.create(null);
                this.#isObject = true;
            }
            for (const [key, val] of entries) this.item(key).set(val, options);
            if (!options?.patch) {
                for (const key in this.#value) {
                    entries.some(([k]) => k === key) || this.#value[key].remove();
                }
            }
        }
    }
    $patch(value) {
        const oldValue = this.#value;

        if (this.constructor.isPrimitive(value)) {
            if (this.#isObject !== false || !this.constructor.equals(oldValue, value)) {
                this.#value = value;
                this.#isObject = false;
                if (!this.#isGetting) {
                    dispatchEvent(this, 'change', { item: this, oldValue, value });
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            if (!this.#isObject) this.#value = Object.create(null);
            this.#isObject = true;
            for (const key in value) this.item(key).set(value[key]);
        }
    }

    get path() {
        if (this.#parent == null) return [];
        return [...this.#parent.path, this.key];
    }

    // Promise states
    #pending = false;
    #error;
    #promise;
    get pending() { return this.#pending; } // todo? registerCurrentEffectFor(this) ?
    get error() { return this.#error; } // todo? registerCurrentEffectFor(this) ?
    get promise() {
        if (!this.#pending) return Promise.resolve(this.get());
        registerCurrentEffectFor(this);
        return this.#promise;
    }
    set promise(promise) {
        this.#promise = promise;
        this.#pending = true;
        this.#error = undefined;
        dispatchEvent(this, 'change', { item: this, pending: true });
        promise.then(
            resolved => {
                if (this.#promise !== promise) return; // wurde überschrieben
                this.#pending = false;
                this.#promise = undefined;
                this.$set(resolved);
            },
            error => {
                if (this.#promise !== promise) return;
                this.#error = error;
                this.#pending = false;
                this.#promise = undefined;
                dispatchEvent(this, 'change', { item: this, error });
            }
        );
    }

    // object related

    item(key) {
        key = String(key);
        if (key === '') throw new Error('key must not be empty');
        if (!this.#isObject) this.#value = Object.create(null);
        this.#isObject = true;
        if (!(key in this.#value)) {
            const Klass = this.ChildClass ?? this.constructor;
            const item = new Klass(this, key);
            this.#value[key] = item;
            dispatchEvent(this, 'change', { item: this, add: item });
        }
        return this.#value[key];
    }

    sub(...keys) {
        let current = this;
        for (const key of keys.flat()) current = current.item(key);
        return current;
    }

    remove() {
        if (!this.#parent) throw new Error('cannot remove root item');
        delete this.#parent.#value[this.#key];
        dispatchEvent(this.#parent, 'change', { item: this.#parent, remove: this });
    }

    has(key) {
        registerCurrentEffectFor(this);
        return typeof this.#value === 'object' && key in this.#value;
    }

    get keys() {
        registerCurrentEffectFor(this);
        return this.#isObject ? Object.keys(this.#value ?? {}) : [];
    }

    *[Symbol.iterator]() {
        for (const key of this.keys) yield this.#value[key];
    }

    items() {
        registerCurrentEffectFor(this);
        if (this.#isObject !== true) return [];
        return Object.values(this.#value);
    }


    // async 

    // loadItems() {}
    // can be implemented by child class
    // it should load the keys of the items, but not necessarily the values
    // async loadItems() { await getKeys(); for (const key of keys) this.item(key); }

    async *[Symbol.asyncIterator]() {
        for (const item of Object.values(this.#value ?? {})) yield item;
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, 'change', { signal: abortCtrl.signal });
        this.loadItems?.().then(() => abortCtrl.abort());
        for await (const { detail: { add } } of iterator) if (add) yield add;
    }

    // misc

    get proxy() { return toProxy(this); }

    toJSON() { return this.get(); }
    valueOf() { return this.get(); }

    toString() {
        registerCurrentEffectFor(this); // todo: .get() already registers the effect
        if (this.constructor.isPrimitive(this.#value)) return String(this.get() ?? '');
        return this.#key ?? '';
    }

    [Symbol.toPrimitive](hint) {
        if (hint === 'string') return this.toString();
        const value = this.constructor.isPrimitive(this.#value) ? this.get() : this.#key;
        if (hint === 'number') return Number(value);
        return this.#value;
    }

    // static methods

    static isPrimitive(value) {
        return value !== Object(value) || 'toJSON' in value;
    }
    static equals(a, b) {
        if (Object.is(a, b)) return true; // question: should use deepEqual as "primitive" can be an object?
    }

    static ChildClass;
    ChildClass = this.constructor.ChildClass;
}


/**
 * Create a new Item instance.
 * @param {any} [value] - The initial value.
 * @return {Item} A new Item instance.
 */
export function item(...args) {
    const v = new Item();
    if (args.length > 0) v.set(args[0]);
    return v;
}


// signal / effect

const relatedEffects = new WeakMap();
let activeEffect = null;
let queue = null;

/**
 * Execute the provided function and re-execute it when dependencies change.
 * @param {function} fn - A function that executes immediately and collects the containing items.
 * @return {function} A function to dispose the effect.
 */
export function effect(fn) { // async?
    const parent = activeEffect;
    if (parent) {
        (parent.nested ??= new Set()).add(fn);
        if (fn.parent && fn.parent !== parent) throw new Error('effect(cb) callbacks should not be reused for other effects');
        fn.parent = parent;
    }
    activeEffect = fn;
    try { fn({ self: fn }); } // await, so that signals in async functions are collected?
    finally { activeEffect = parent; }
    return () => fn.disposed = true
}

function batch(effect) {
    if (queue) return queue.add(effect); // currently collecting
    queue = new Set([effect]);
    queueMicrotask(() => {
        for (const fn of queue) {
            if (queue.has(fn?.parent)) continue; // skip if parent already runs
            activeEffect = fn; // effect() called inside fn(callback) has to know his parent effect
            try { fn({ self: fn }); } catch (err) { console.error(err); } // hm? fn({rerun:fn})/fn({self:fn}) to rerun effect? https://github.com/nuxodin/item.js/issues/2
        }
        activeEffect = null;
        queue = null; // restart collecting, todo? we could also keep collecting while running, but it can cause infinite loops if not careful
    });
}

function registerCurrentEffectFor(signal) {
    if (!activeEffect) return;
    (relatedEffects.get(signal) ?? relatedEffects.set(signal, new Set()).get(signal)).add(activeEffect);
}

function triggerEffectsFor(signal) {
    const effects = relatedEffects.get(signal);
    if (!effects) return;
    for (const fn of effects) {
        fn.nested?.forEach(fn => fn.disposed = true); // dispose child-effects
        if (fn.disposed) effects.delete(fn);
        else batch(fn);
    }
}


// proxy

export const $item = Symbol('item.js [proxy target]');



/* OLD
const proxyHandler = {
    get: function (target, property, receiver) {
        if (property === $item) return target;
        // if (target.asyncHandler && property === 'then') { // instanceof AsyncItem, make it a thenable, would be great if it can be handled by a proxy-trap
        //     return (onFulfilled, onRejected) => target.get().then(onFulfilled, onRejected);
        // }
        if (property === Symbol.iterator) {
            return function* () {
                for (const childItem of target) { 
                    yield toProxy(childItem);
                }
            };
        }
        if (typeof property === 'symbol') {
            if (typeof target[property] === 'function') return target[property].bind(target);
            return Reflect.get(target, property, receiver);
        }

        const item = target.item(property);

        if (item.pending) return item.promise;

        return toProxy(item);
        const value = item.get(); // TODO?: Is accessing item.get() here good? it will trigger a get event (E.g. fetch data)
        return item.constructor.isPrimitive(value) ? value : toProxy(item);
    },
    set: function (target, property, value) {
        target.item(property).set(value);
        return true;
    },
    apply: function (target, thisArg, argumentsList) {
        console.log('apply called', target.path, thisArg, argumentsList);
        return true;
    },
    has: (target, property) => target.has(property),
    ownKeys: (target) => target.keys,
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    deleteProperty: function (target, property) {
        target.item(property).remove();
        return true;
    },
};

const cachedProxies = new WeakMap();
const toProxy = (item) => {
    if (!cachedProxies.has(item)) cachedProxies.set(item, new Proxy(item, proxyHandler));
    return cachedProxies.get(item);
}
*/


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

const toProxy = (itm) => {
    if (!cachedProxies.has(itm)) {
        const fn = () => { };
        fn.item = itm;
        cachedProxies.set(itm, new Proxy(fn, proxyHandler));
    }
    return cachedProxies.get(itm);
};


/**
 * Dispatch a custom event on the item and its ancestors.
 * @param {Item} item - The item to dispatch the event on.
 * @param {string} eventName - The name of the event. eventName+"In" will be dispatched on the ancestors. (bubbles)
 * @param {Object} detail - The event details.
 * @return {Object} An object containing a `defaultPrevented` property.
 */
export function dispatchEvent(item, eventName, detail) {
    const options = { detail, cancelable: true };
    const event = new CustomEvent(eventName, options);
    item.dispatchEvent(event);
    const eventIn = new CustomEvent(eventName + 'In', options);
    let current = item;
    while (current) {
        current.dispatchEvent(eventIn);
        current = current.parent;
    }
    return {
        defaultPrevented: eventIn.defaultPrevented || event.defaultPrevented,
    }
}


/**
 * Creates a async iterator from an event target.
 * @param {EventTarget} eventTarget - The event target.
 * @param {string} eventName - The name of the event.
 * @param {Object} [options] - The event listener options.
 * @return {Generator} A generator that yields events.
 * @example
 * const abortCtrl = new AbortController();
 * for await (const event of asyncIteratorFromEventTarget(document, 'click', {signal: abortCtrl.signal})) {
 *    console.log(event);
 * }
 * setTimeout(() => abortCtrl.abort(), 1000);
 */
export async function* asyncIteratorFromEventTarget(eventTarget, eventName, options) {
    const queue = [];
    let stopAfterQueue = false;
    let resolve;
    const eventHandler = event => {
        queue.push(event);
        if (resolve) {
            resolve();
            resolve = null;
        }
    };
    eventTarget.addEventListener(eventName, eventHandler, options);
    options?.signal?.addEventListener('abort', () => {
        stopAfterQueue = true;
        if (resolve) {
            resolve();
            resolve = null;
        }
    });
    try {
        while (true) {
            if (queue.length) {
                yield queue.shift();
            } else if (stopAfterQueue) {
                return;
            } else {
                await new Promise(res => resolve = res); // Promise.withResolvers()?
            }
        }
    } finally {
        eventTarget.removeEventListener(eventName, eventHandler, options);
    }
}
