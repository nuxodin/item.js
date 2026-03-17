import { toProxy, $item } from "./src/proxy.js";
import { asyncIteratorFromEventTarget, Emitter, ItemEvent, } from "./src/Emitter.js";
import { AsyncDataPoint } from "./src/AsyncDataPoint.js";
import { effect, track, notify } from "./src/signal.js";
export { effect, $item };

const EMPTY_ARRAY = Object.freeze([]);

export class Item extends Emitter {
    
    #value;
    #parent = null;
    #key = null;
    #path;
    #root;
    #isObject = null; // null:not filled, true:object, false:primitive value
    #isSetting = false;
    
    constructor(parent, key) {
        super();
        this.#parent = parent ?? null
        this.#key = key ?? null;
    }

    get key()        { return this.#key; }
    get parent()     { return this.#parent; }
    get filled()     { return this.#isObject !== null; }
    get isObject()   { return this.#isObject; }
    set value(value) { this.set(value); }
    get value()      { return this.get(); }

    get(options) {
        dispatch(this, 'get', { value: this.#value });
        track(this);
        return this.$get(options);
    }

    set(value, options) {
        if (this.#isSetting) throw new Error("circular set");
        this.#isSetting = true;
        const event = dispatch(this, "set", {oldValue: this.#value, value, options});
        let ioPromise = undefined;
        if (!event.defaultPrevented) {
            value = event.value;
            this.$set(value, options);
            if (this.writer && !options?.local) ioPromise = this.io.set(value);
        }
        this.#isSetting = false;
        return ioPromise; // what about nested items? await also?
    }

    patch(value) { return this.set(value, { patch: true }); }

    $set(value, options) {
        const oldValue = this.#value;

        if (this.constructor.isPrimitive(value)) {
            const equal = this.#isObject === false && this.constructor.equals(oldValue, value); 
            if (!equal) {
                if (this.#isObject) this.#clearChildren();
                this.#value = value;
                this.#isObject = false;
                dispatch(this, "change", { oldValue, value, options });
            }
        } else {
            this.#ensureObject();
            const entries = Object.entries(value);
            const depth = options?.depth ?? Infinity;
            for (const [key, val] of entries) {
                const item = this.item(key);
                if (depth > 1) item.set(val, { ...options, depth: depth - 1 });
            }
            if (!options?.patch) {
                for (const key in this.#value) {
                    (key in value) || this.#value[key].remove(options);
                }
            }
        }
    }

    $get(options) {
        if (!this.#isObject) return this.#value;
        const depth = options?.depth ?? Infinity;
        const value = this.#value ??= Object.create(null); // kann eigentlich nicht null/undefined sein.
        const result = Object.create(null);
        for (const key in value) {
            result[key] = depth > 1 ? value[key].get({ ...options, depth: depth - 1 }) : null;
        }
        return result;
    }
    
    clear() {
        if (this.#isObject) this.#clearChildren();
        this.#value = undefined;
        this.#isObject = null;
        this.#io?.dispose();
        this.#io = null;
        this.removeAllListeners();
    }

    /* object related */

    #clearChildren() {
        for (const child of Object.values(this.#value)) child.clear();
    }

    #ensureObject() {
        if (!this.#isObject) {
            dispatch(this, "change", { oldValue:this.#value, value:null }); // null ok?
            this.#value = Object.create(null);
            this.#isObject = true;
        }
    }

    item(key) {
        key = String(key);
        this.#ensureObject();
        if (!(key in this.#value)) {
            if (this.ChildClass === false) throw new Error(`${this.constructor.name} has no children`);
            const Klass = this.ChildClass ?? this.constructor;
            const item = new Klass(this, key);
            this.#value[key] = item;
            dispatch(this, "change", { add: item });
        }
        return this.#value[key];
    }

    async add(value) {
        let key = this.adder ? (await this.adder(value)).key : this.generateKey();
        if (key == null) throw new Error("[item.js] a key must be generated");
        if (this.has(key)) throw new Error(`[item.js] key "${key}" already exists`)
        const item = this.item(key);
        item.set(value, { local: true });
        return item;
    }

    generateKey() { return crypto.randomUUID() } // items with no ".adder()"

    async remove(options) {
        if (!this.#parent) throw new Error("cannot remove root item");
        delete this.#parent.#value[this.#key];
        dispatch(this.#parent, "change", { remove: this });
        if (this.remover && !options?.local) await this.remover();
        this.clear();
    }

    sub(...keys) {
        let current = this;
        for (const key of keys.flat()) current = current.item(key);
        return current;
    }

    #has(key) {
        track(this);
        return this.#isObject && key in this.#value ? this.item(key) : undefined;
    }

    has(...keys) {
        let current = this;
        for (const key of keys.flat()) if (!(current = current.#has(key))) return;
        return current;
    }

    get keys() {
        track(this);
        return this.#isObject ? Object.keys(this.#value ?? {}) : EMPTY_ARRAY;
    }

    get path() { return this.#path ??= this.#parent == null ? EMPTY_ARRAY : [...this.#parent.path, this.#key]; }

    get root() { return this.#root ??= this.#parent?.root ?? this; }

    *[Symbol.iterator]() {
        for (const key of this.keys) yield this.#value[key];
    }

    items() {
        track(this);
        if (this.#isObject !== true) return EMPTY_ARRAY;
        return Object.values(this.#value);
    }

    /* Async */

    #io = null;

    get io() {
        if (!this.#io) {
            this.#io = new AsyncDataPoint({
                get: (signal) => this.reader(null, {signal}),
                set: (v, signal) => this.writer(v, {signal}),
            });
            this.#io.onchange = ({value, error}) => {
                if (error) return dispatch(this, "change", { error });
                if (value === undefined) return; // reader adds subitems by itself
                this.set(value, {patch: true, local: true});
            }
            this.#io.onpending = () => dispatch(this, "change", { pending: true });
        }
        return this.#io;
    }

    async read(query) {
        if (!query) return (this.reader || this.#io?.isPending) ? await this.io.get() : false;
        if (!this.reader) throw new Error('[item.js] read(query) requires a reader')
        const data = await this.reader(query);
        //if (data !== undefined) this.set(data, { local: true, depth: query?.depth??1 }); 
        // open falsch, depth sollte remote definiert werden (im idealfall so wie geschickt zurück kommen)
        //if (query?.depth && query.depth !== data.depth) console.log("reader depth mismatch", query.depth, data.depth);
        if (data !== undefined) this.set(data, { local: true, depth: 1 });
    }

    async *[Symbol.asyncIterator]() {
        for (const item of Object.values(this.#value ?? {})) {
            if (!this.isObject) return; // no longer an object (or cleared)
            yield item;
        }
        if (!this.isObject) return; // no longer an object (or cleared)
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, "change", { signal: abortCtrl.signal });
        this.read().then(() => abortCtrl.abort()); // hm... read will call get but should only create direct child-items...
        for await (const { add } of iterator) {
            if (add) {
                if (!this.isObject) return; // no longer an object (or cleared)
                yield add;
            }
        }
    }

    set promise(promise) { this.io.setFromPromise(promise); }
    get pending()        { track(this); return this.#io?.isPending ?? false; }
    get error()          { track(this); return this.#io?.lastError ?? undefined; }

    /* JSON Schema */

    #schema = null;

    setSchema(schema) {
        for (let p = this.#parent; p; p = p.#parent) {
            if (p.#schema) throw new Error(`ancestor "${p.path.join('.')}" already has a schema`);
        }
        this.#schema = schema;
    }

    get schema() {
        if (this.#schema != null) return this.#schema;
        const parentSchema = this.#parent?.schema;
        if (!parentSchema) return null;
        return parentSchema.properties?.[this.#key] ?? parentSchema.items ?? parentSchema.additionalProperties ?? null;
    }

    set schema(v) { throw new Error('use setSchema() to assign a schema'); }

    /* misc */

    get proxy() { return toProxy(this); }

    toJSON()   { return this.get(); }
    valueOf()  { return this.get(); }
    toString() {
        if (this.#isObject) { track(this); return this.#key ?? ""; }
        return String(this.get() ?? "");
    }

    [Symbol.toPrimitive](hint) {
        if (hint === "string") return this.toString();
        const value = this.#isObject ? this.#key : this.get();
        if (hint === "number") return Number(value);
        return this.#value;
    }

    ChildClass = this.constructor.ChildClass;

    /* static members */

    static isPrimitive(value) {
        const t = typeof value;
        return t !== 'object' && t !== 'function' || value === null;
    }

    static equals(a, b) { return Object.is(a, b); }

    static ChildClass;
}

export function item(...args) {
    const v = new Item();
    if (args.length > 0) v.set(args[0]);
    return v;
}

export function dispatch(item, eventName, options) {
    const event = new ItemEvent(eventName, options);
    item.dispatchEvent(event);
    if (eventName === 'change') notify(item);
    event.type = eventName+'In'; // reuse event object
    for (let i = item; i; i = i.parent) i.dispatchEvent(event);
    return event;
}
