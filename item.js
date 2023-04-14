
/**
 * Class representing an item.
 * @extends EventTarget
 */
export class Item extends EventTarget {

    #value;
    #parent;
    #key;
    #filled = false;
    #isGetting = false;
    #isSetting = false;

    constructor(parent, key){
        super();
        this.#parent = parent;
        this.#key = key;
        this.addEventListener('change', () => triggerEffectsFor(this) ); // the method that triggers the change effect can be overwritten by a child class, therefore we use the event
    }

    get key(){ return this.#key }
    get parent(){ return this.#parent }
    get filled(){ return this.#filled }

    set value(value){ this.set(value); }
    get value(){ return this.get(); }

    get(){
        if (this.#isGetting) throw new Error('circular get');
        this.#isGetting = true;
        dispatchEvent(this, 'get', { item: this, value:this.#value });
        registerCurrentEffectFor(this);
        this.#isGetting = false;
        return this.$get();
    }
    set(value){
        if (this.#isSetting) throw new Error('circular set');
        this.#isSetting = true;
        const obj = dispatchEvent(this, 'set', { item:this, oldValue:this.#value , value });
        const result = !obj.defaultPrevented ? this.$set(value) : null;
        this.#isSetting = false;
        return result;
    }
    $get(){
        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            const value = this.#value ??= Object.create(null); // if undefined, create object
            return Object.fromEntries(Object.entries(value).map(([key, {value}]) => [key, value]));
        }
    }
    $set(value){
        const oldValue = this.#value;
        if (this.constructor.isPrimitive(value)) {
            if (!this.#filled || oldValue !== value) { // TODO: we shoul use deepEqual as "primitive" can be an object
                this.#value = value; // structuralClone(value); // TODO: should we clone the value? or should we just use the reference? (if its an object)
                this.#filled = true;
                if (!this.#isGetting) {
                    dispatchEvent(this, 'change', { item: this, oldValue, value });
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            for (const key in value) this.item(key).set(value[key]);
            if (this.#value && Object(this.#value)) { // remove keys that are not in value
                for (const key in this.#value) if (!(key in value)) this.#value[key].remove();
            }
        }
    }
    item(key){
        key = String(key);
        if (this.#value == null || typeof this.#value !== 'object') { // item() forces value always to be object
            this.#value = Object.create(null);
            this.#filled = true;
        }
        if (!(key in this.#value)) {
            const Klass = this.ChildClass ?? this.constructor;
            const item = new Klass(this, key);
            dispatchEvent(this, 'change', { item: this, add:item });
            this.#value[key] = item;
        }
        return this.#value[key];
    }
    remove(){
        if (this.#parent) {
            delete this.#parent.#value[this.#key];
            dispatchEvent(this.#parent, 'change', { item: this.#parent, remove: this });
        } else {
            throw new Error('cannot remove root item');
        }
    }
    has(key){ return key in this.#value; }
    //asyncHas(key){ return Promise.resolve(key in this.#value) }

    get proxy(){ return toProxy(this); }

    // path
    get path() {
        if (this.#parent == null) return [this];
        return [...this.#parent.path, this];
    }
    get pathKeys() {
        return this.path.slice(1).map(item => item.key);
    }
    walkPathKeys(keys) {
        if (keys.length === 0) return this;
        return this.item(keys[0]).walkPathKeys(keys.slice(1));
    }

    toJSON() { return this.get(); }
    valueOf() { return this.get(); }
    toString() { return this.get()+'' } // if its an object, this.key would be better

    // iterator
    // iterators should probably trigger "get", but not compute the value
    *[Symbol.iterator]() {
        for (const key in this.get()) yield this.#value[key];
    }

    async *[Symbol.asyncIterator]() {
        for (const item of Object.values(this.#value ?? {})) yield item;
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, 'change', { signal:abortCtrl.signal });
        this.loadItems().then(() => abortCtrl.abort());
        for await (const {detail:{add}} of iterator) if (add) yield add;
    }

    loadItems(){ throw new Error('not implemented'); } // can be overwritten by child class

    static isPrimitive(value){
        return value !== Object(value) || 'toJSON' in value || value instanceof Promise;
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
 * @param {function} fn - A function that executes imeediately and collects the containing items.
 * @return {function} A function to dispose the effect.
 */
export function effect(fn){
    const outer = currentEffect;
    if (outer) {
        (outer.nested ??= new Set()).add(fn);
        if (fn.parent && fn.parent !== outer) throw('effect(cb) callbacks should not be reused for other effects');
        fn.parent = outer;
    }
    currentEffect = fn;
    fn();
    currentEffect = outer;
    return () => fn.disposed = true
}

/**
 * Create a computed item based on the provided calculation function.
 * @param {function} calc - The calculation function.
 * @return {Item} A new computed item.
 */
export function computed(calc){
    const signal = item();
    effect(()=>signal.set(calc())); // todo: only primitive?
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
            fn(); // TODO? fn(fn) to rerun effect? https://github.com/nuxodin/item.js/issues/2
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
const proxyHandler = {
    get: function(target, property, receiver){
        if (target.master && property === 'then') { // instanceof AsyncItem, make it a thenable, would be great if it can be handled by a proxy-trap
            return (onFulfilled, onRejected) => target.get().then(onFulfilled, onRejected);
        }
        if (property === '$item') return target;

        if (typeof property === 'symbol') {
            if (typeof target[property] === 'function') return target[property].bind(target);
            return Reflect.get(target, property, receiver);
        }

        const item = target.item(property);
        const value = item.get(); // TODO?: Is accessing item.get() here good? it will trigger a get event (E.g. fetch data)
        return item.constructor.isPrimitive(value) ? value : toProxy(item);
    },
    set: function(target, property, value){
        target.item(property).set(value);
        return true;
    },
    has: (target, property) => target.has(property),
    ownKeys: (target)=> Reflect.ownKeys(target.get()),
    getOwnPropertyDescriptor: (target, property)=>{
        return { configurable: true, enumerable: true, get: ()=>target.get(property), set: (value)=>target.set(property, value) };
    },
    deleteProperty: function(target, property){
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
 * @param {string} eventName - The name of the event. eventName+"In" will be dispatched on the ancestors. (bubbles)
 * @param {Object} detail - The event details.
 * @return {Object} An object containing a `defaultPrevented` property.
 */
export function dispatchEvent(item, eventName, detail){

    const options = {detail, cancelable: true};

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
function* asyncIteratorFromEventTarget(eventTarget, eventName, options) {
    const queue = [];
    let stopAfterQueue = false;
    let resolve;
    const eventHandler = event => {
        resolve ? resolve(event) : queue.push(event);
        resolve = null;
    };
    eventTarget.addEventListener(eventName, eventHandler, options);
    options?.signal?.addEventListener('abort', () => stopAfterQueue = true);
    try {
        while (true) {
            if (queue.length) {
                yield queue.shift();
            } else if (stopAfterQueue) {
                return;
            } else {
                yield new Promise(res => resolve = res);
            }
        }
    } finally {
        eventTarget.removeEventListener(eventName, eventHandler, options);
    }
}
