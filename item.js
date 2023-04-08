
// Item
export class Item extends EventTarget {

    #value;
    #parent;
    #key;
    #filled = false;
    #isgetting = false;
    #issetting = false;

    constructor(parent, key){
        super();
        this.#parent = parent;
        this.#key = key;
        this.addEventListener('change', () => triggerEffectsFor(this) ); // the method that triggers the change effect can be overwritten by a child class, therefore we use the event
    }

    get key(){ return this.#key }
    get parent(){ return this.#parent }
    get filled(){ return this.#filled }

    set value(value){
        this.set(value);
    }
    get value(){
        return this.get();
    }
    get(){
        if (this.#isgetting) throw new Error('circular get');
        this.#isgetting = true;
        dispatchEvent(this, 'get', { item: this, value:this.#value });
        registerCurrentEffectFor(this);
        this.#isgetting = false;
        return this.$get();
    }
    set(value){
        if (this.#issetting) throw new Error('circular set');
        this.#issetting = true;
        const obj = dispatchEvent(this, 'set', { item:this, oldValue:this.#value , value });
        const result = !obj.defaultPrevented ? this.$set(value) : null;
        this.#issetting = false;
        return result;
    }
    $get(){
        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            const value = this.#value ??= Object.create(null); // if undefined, create object (todo? should always be object)
            return Object.fromEntries(Object.entries(value).map(([key, {value}]) => [key, value]));
        }
    }
    $set(value){
        const oldValue = this.#value;
        if (this.constructor.isPrimitive(value)) {
            if (!this.#filled || oldValue !== value) { // TODO: we shoul use deepEqual as "primitive" can be an object
                this.#value = value;
                this.#filled = true;
                if (!this.#isgetting) {
                    dispatchEvent(this, 'change', { item: this, oldValue, value });
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            for (const key of Object.keys(value)) this.item(key).set(value[key]);
            if (this.#value && Object(this.#value)) { // remove keys that are not in value
                for (const key of Object.keys(this.#value)) if (!(key in value)) this.#value[key].remove();
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
    remove(){ // beta?
        if (this.#parent) {
            delete this.#parent.#value[this.#key];
            dispatchEvent(this.#parent, 'change', { item: this.#parent, remove: this });
        } else {
            throw new Error('cannot remove root item');
        }
    }

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
    toString() { return String(this.get()); }

    get [Symbol.iterator]() {
        this.get(); // trigger getter, for signals and collecting children (too expensive?)
        return function *(){
            for (const key in this.#value) yield this.#value[key];
        }
    }

    // iterate over all items, even if not loaded yet
    // TODO: add change-event-listener to deliver new items when they are loaded
    // TODO: wait for new values if its not an object? Or make a separate method for that? because that would also be useful for objects
    async *[Symbol.asyncIterator]() {
        const yielded = new Set();
        for (const item of Object.values(this.#value)) {
            yielded.add(item);
            yield item;
        }
        await this.loadAll();
        for (const item of Object.values(this.#value)) if (!yielded.has(item)) yield item;
    }


    static isPrimitive(value){
        return value !== Object(value) || 'toJSON' in value || value instanceof Promise;
    }

    static ChildClass;
    ChildClass = this.constructor.ChildClass;
}

export const item = (...args) => {
    const v = new Item();
    if (args.length > 0) v.set(args[0]);
    return v;
}


// signal / effect
const relatedEffects = new WeakMap();
let currentEffect = null;

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
        if (typeof property === 'symbol') return Reflect.get(target, property, receiver);
        if (property === '$item') return target;

        const item = target.item(property);

        // todo: accessing item.value here is not good, it will trigger a get event (E.g. fetch data)
        const value = item.get();
        if (item.constructor.isPrimitive(value)) {
            return value;
        } else {
            return toProxy(item);
        }
    },
    set: function(target, property, value, receiver){
        if (typeof property === 'symbol') return Reflect.set(target, property, value, receiver);
        target.item(property).set(value);
        return true;
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

export function proxy(arg){
    if (arg instanceof Item) return toProxy(arg);
    else return toProxy(item(arg));
}


// helpers
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
