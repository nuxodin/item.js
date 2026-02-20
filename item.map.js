
/**
 * Lightweight custom event emitter (replaces EventTarget for performance).
 * Supports: addEventListener, removeEventListener, dispatchEvent, cancelable, signal, once.
 */
class EventEmitter {
    // listeners stored as plain arrays: [fn, fn, fn, ...]
    // "complex" entries (once/signal) stored separately to keep the fast path lean
    #listeners = null; // Map<string, Array<fn>> – created lazily

    addEventListener(type, listener, options) {
        if (!this.#listeners) this.#listeners = new Map();
        const arr = this.#listeners.get(type);
        if (arr) arr.push(listener);
        else this.#listeners.set(type, [listener]);
        if (options?.once || options?.signal) {
            const cleanup = () => this.removeEventListener(type, listener);
            if (options.once) {
                // wrap so it removes itself after first call
                const wrapped = (e) => { cleanup(); listener.call(this, e); };
                // replace the last pushed fn with the wrapper
                const a = this.#listeners.get(type);
                a[a.length - 1] = wrapped;
            }
            if (options.signal) {
                options.signal.addEventListener('abort', cleanup, { once: true });
            }
        }
    }

    removeEventListener(type, listener) {
        const arr = this.#listeners?.get(type);
        if (!arr) return;
        const idx = arr.indexOf(listener);
        if (idx !== -1) arr.splice(idx, 1);
    }

    dispatchEvent(event) {
        const arr = this.#listeners?.get(event.type);
        if (!arr || arr.length === 0) return;
        // snapshot to guard against mutations during dispatch
        const snapshot = arr.length === 1 ? arr : arr.slice();
        for (let i = 0; i < snapshot.length; i++) snapshot[i].call(this, event);
    }

    /** fast check: does this item have any listeners for a given type? */
    hasListeners(type) {
        const arr = this.#listeners?.get(type);
        return arr != null && arr.length > 0;
    }
}

/**
 * Lightweight cancelable event object (replaces CustomEvent).
 */
class ItemEvent {
    type;
    detail;
    defaultPrevented = false;
    constructor(type, detail) {
        this.type = type;
        this.detail = detail;
    }
    preventDefault() { this.defaultPrevented = true; }
}

/**
 * Class representing an item.
 */
export class Item extends EventEmitter {

    #value;
    #parent;
    #key;
    #filled = false;
    #isObject = false; // true when #value is a Map (avoids instanceof checks)
    #isGetting = false;
    #isSetting = false;

    // Promise states
    #pending = false;
    #error;
    #promise;
    get pending() { return this.#pending; } // todo? registerCurrentEffectFor(this) ?
    get error() { return this.#error; } // todo? registerCurrentEffectFor(this) ?
    get promise() {
        return this.#pending ? this.#promise : Promise.resolve(this.get());
    }
    set promise(promise) {
        this.#promise = promise;
        this.#pending = true;
        this.#error = undefined;
        this.#filled = false;
        //dispatchEvent(this, 'change', { item: this, oldValue, value: this.#value }); // todo? pending state changed
        promise.then(
            resolved => {
                if (this.#promise !== promise) return; // wurde überschrieben
                this.#filled = true;
                this.#pending = false;
                this.#promise = undefined;
                this.$set(resolved);
            },
            error => {
                if (this.#promise !== promise) return;
                this.#error = error;
                this.#pending = false;
                this.#promise = undefined;
                // some event? dispatchEvent(this, 'change', { item: this, oldValue, value: this.#value });
            }
        );
    }

    constructor(parent, key) {
        super();
        this.#parent = parent;
        this.#key = key;
        this.addEventListener('change', () => triggerEffectsFor(this));
    }

    get key() { return this.#key }
    get parent() { return this.#parent }
    get filled() { return this.#filled }

    set value(value) { this.set(value); }
    get value() { return this.get(); }

    get() {
        if (this.#isGetting) throw new Error('circular get');
        this.#isGetting = true;
        // fast-path: only call dispatchEvent if there are any 'get'/'getIn' listeners
        dispatchEvent(this, 'get', () => ({ item: this, value: this.#value }));
        // inline currentEffect check avoids a function call in the common case (no active effect)
        if (currentEffect) registerCurrentEffectFor(this);
        this.#isGetting = false;
        return this.$get();
    }
    set(value) {
        if (this.#isSetting) throw new Error('circular set');
        this.#isSetting = true;
        const obj = dispatchEvent(this, 'set', () => ({ item: this, oldValue: this.#value, value }));
        const result = !obj.defaultPrevented ? this.$set(value) : null;
        this.#isSetting = false;
        return result;
    }
    $get() {
        if (!this.#isObject) return this.#value;  // primitive fast-path
        const map = this.#value ??= (this.#isObject = true, new Map());
        const out = Object.create(null);
        for (const [key, child] of map) out[key] = child.value;
        return out;
    }
    $set(value) {
        const oldValue = this.#value;

        if (value instanceof Promise) {
            console.warn('setting a promise directly on an item is deprecated, use item.promise = promise instead');
            this.promise = value;
            return;
        }

        if (this.constructor.isPrimitive(value)) {
            if (!this.#filled || !this.constructor.equals(oldValue, value)) {
                this.#value = value;
                this.#isObject = false;
                this.#filled = true;
                if (!this.#isGetting) {
                    dispatchEvent(this, 'change', () => ({ item: this, oldValue, value }));
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            if (!this.#isObject) { this.#value = new Map(); this.#isObject = true; }
            this.#filled = true;

            for (const key in value) this.item(key).set(value[key]);
            for (const key of this.#value.keys()) if (!(key in value)) this.#value.get(key).remove();
        }
    }

    // get chain() { // implement if needed/requested
    //     if (this.#parent == null) return [this];
    //     return [...this.#parent.chain, this];
    // }
    get path() {
        if (this.#parent == null) return [];
        return [...this.#parent.path, this.key];
    }

    // object related
    item(key) {
        if (typeof key !== 'string') key = String(key); // skip coercion for string keys (common case)
        if (!this.#isObject) { // item() forces value always to be object
            this.#value = new Map();
            this.#isObject = true;
            this.#filled = true;
        }
        let child = this.#value.get(key);
        if (!child) {
            const Klass = this.ChildClass ?? this.constructor;
            child = new Klass(this, key);
            this.#value.set(key, child);
            dispatchEvent(this, 'change', () => ({ item: this, add: child }));
        }
        return child;
    }
    sub(...keys) {
        let current = this;
        for (const key of keys.flat()) current = current.item(key);
        return current;
    }

    items() {
        if (!this.filled) return null;
        if (!this.#isObject) return null;
        return Array.from(this.#value.values());
    }

    remove() {
        if (!this.#parent) throw new Error('cannot remove root item');
        this.#parent.#value.delete(this.#key);
        dispatchEvent(this.#parent, 'change', () => ({ item: this.#parent, remove: this }));
    }
    has(key) { return this.#isObject && this.#value.has(key); }

    get proxy() { return toProxy(this); }

    get keys(){
        return this.#isObject ? Array.from(this.#value.keys()) : [];
    }

    // loadItems() {}
    // can be implemented by child class
    // it should load the keys of the items, but not necessarily the values
    // async loadItems() { await getKeys(); for (const key of keys) this.item(key); }

    // iterator
    // iterators should probably trigger "get", but not compute the value
    *[Symbol.iterator]() {
        if (this.#isObject) {
            for (const item of this.#value.values()) yield item;
        }
    }

    async *[Symbol.asyncIterator]() {
        if (this.#isObject) {
            for (const item of this.#value.values()) yield item;
        }
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, 'change', { signal: abortCtrl.signal });
        this.loadItems?.().then(() => abortCtrl.abort());
        for await (const { detail: { add } } of iterator) if (add) yield add;
    }

    // integration
    toJSON() { return this.get(); }
    valueOf() { return this.get(); }
    toString() { return this.get() + '' } // if its an object, this.key would be better    


    static isPrimitive(value) {
        return value !== Object(value) || 'toJSON' in value;
    }
    static equals(a, b) { // comparison function between old and new value in case of primitive
        if (Object.is(a, b)) return true; // TODO: we should use deepEqual as "primitive" can be an object
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
let currentEffect = null;

/**
 * Execute the provided function and re-execute it when dependencies change.
 * @param {function} fn - A function that executes immediately and collects the containing items.
 * @return {function} A function to dispose the effect.
 */
export function effect(fn) { // async?
    const outer = currentEffect;
    if (outer) {
        (outer.nested ??= new Set()).add(fn);
        if (fn.parent && fn.parent !== outer) throw ('effect(cb) callbacks should not be reused for other effects');
        fn.parent = outer;
    }
    currentEffect = fn;
    try { fn(); } // await, so that signals in async functions are collected?
    finally { currentEffect = outer; }
    return () => fn.disposed = true
}

/**
 * Create a computed item based on the provided calculation function.
 * @param {function} calc - The calculation function.
 * @return {Item} A new computed item.
 */
export function computed(calc) {
    const signal = item();
    effect(() => signal.set(calc())); // todo: only primitive?
    return signal;
}

let batches = null;
function batch(effect) {
    if (batches) return batches.add(effect); // currently collecting
    batches = new Set([effect]);
    queueMicrotask(() => {
        batches.forEach(fn => {
            if (batches.has(fn?.parent)) return; // its parent has also to run, so it will run anyway
            currentEffect = fn; // effect() called inside fn(callback) has to know his parent effect
            // todo? try
            fn(); // TODO? fn({rerun:fn}) to rerun effect? https://github.com/nuxodin/item.js/issues/2
        });
        batches = null; // restart collecting
    });
}
function registerCurrentEffectFor(signal) {
    if (currentEffect) {
        if (!relatedEffects.has(signal)) relatedEffects.set(signal, new Set());
        relatedEffects.get(signal).add(currentEffect);
    }
}
function triggerEffectsFor(signal) {
    const effects = relatedEffects.get(signal);
    if (effects) {
        effects.forEach(fn => {
            fn.nested?.forEach(fn => fn.disposed = true); // dispose child-effects
            if (fn.disposed) return effects.delete(fn);
            batch(fn);
        });
    }
}

// proxy
// todo? should proxy[iterator] iterate over item

export const $item = Symbol('item.js [proxy target]');

const proxyHandler = {
    get: function (target, property, receiver) {
        // if (target.asyncHandler && property === 'then') { // instanceof AsyncItem, make it a thenable, would be great if it can be handled by a proxy-trap
        //     return (onFulfilled, onRejected) => target.get().then(onFulfilled, onRejected);
        // }
        if (property === $item) return target;
        // if (property === Symbol.iterator) { // also loop proxys
        //     return function* () {
        //         for (const key in target.get()) {
        //             yield receiver[key];
        //         }
        //     }
        // }
        if (typeof property === 'symbol') {
            if (typeof target[property] === 'function') return target[property].bind(target);
            return Reflect.get(target, property, receiver);
        }

        const item = target.item(property);

        if (item.pending) return item.promise;

        const value = item.get(); // TODO?: Is accessing item.get() here good? it will trigger a get event (E.g. fetch data)
        return item.constructor.isPrimitive(value) ? value : toProxy(item);
    },
    set: function (target, property, value) {
        target.item(property).set(value);
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


/**
 * Dispatch a custom event on the item and its ancestors.
 * @param {Item} item - The item to dispatch the event on.
 * @param {string} eventName - The name of the event. eventName+"In" will be dispatched on the ancestors.
 * @param {Object} detail - The event details.
 * @return {Object} An object containing a `defaultPrevented` property.
 */
export function dispatchEvent(item, eventName, detail) {
    // fast-path: skip if nobody listening (avoids detail alloc + ItemEvent allocation)
    const hasOwn = item.hasListeners(eventName);
    const eventNameIn = eventName + 'In';
    let hasBubble = false;
    let cur = item;
    while (cur) {
        if (cur.hasListeners(eventNameIn)) { hasBubble = true; break; }
        cur = cur.parent;
    }
    if (!hasOwn && !hasBubble) return { defaultPrevented: false };

    // resolve lazy detail (factory fn or plain object)
    const resolvedDetail = typeof detail === 'function' ? detail() : detail;

    const event = new ItemEvent(eventName, resolvedDetail);
    if (hasOwn) item.dispatchEvent(event);

    const eventIn = new ItemEvent(eventNameIn, resolvedDetail);
    cur = item;
    while (cur) {
        cur.dispatchEvent(eventIn);
        cur = cur.parent;
    }

    return {
        defaultPrevented: eventIn.defaultPrevented || event.defaultPrevented,
    };
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
                await new Promise(res => resolve = res);
            }
        }
    } finally {
        eventTarget.removeEventListener(eventName, eventHandler, options);
    }
}
