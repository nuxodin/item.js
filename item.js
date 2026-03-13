
import { toProxy, $item } from "./src/proxy.js";
import { asyncIteratorFromEventTarget, Emitter, ItemEvent, } from "./src/Emitter.js";
import { AsyncDataPoint } from "./src/AsyncDataPoint.js";
import { effect, track, notify } from "./src/signal.js";
export { effect, $item };

const EMPTY_ARRAY = Object.freeze([]);

/**
 * Class representing an item.
 * @extends Emitter
 */
export class Item extends Emitter {
    #value;
    #parent;
    #key;
    #path;
    #root;
    #isObject = null; // null:filled, true:object, false:primitive value
    #isSetting = false;

    constructor(parent, key) {
        super();
        this.#parent = parent;
        this.#key = key;
        this.addEventListener("change", () => notify(this));
    }

    get key() { return this.#key; }
    get parent() { return this.#parent; }
    get filled() { return this.#isObject !== null; }
    set value(value) { this.set(value); }
    get value() { return this.get(); }
    get isObject() { return this.#isObject; }

    get() {
        track(this);
        return this.$get();
    }
    set(value, options = {}) {
        if (this.#isSetting) throw new Error("circular set");
        this.#isSetting = true;
        const obj = dispatch(this, "set", { oldValue: this.#value, value, options });
        if (!obj.defaultPrevented) this.$set(value, options);
        const ioPromise = !obj.defaultPrevented && !options?.fromIO && this.writer ? this.io.set(value) : null;
        this.#isSetting = false;
        return ioPromise; // what about nested items? await also?
    }
    patch(value) { return this.set(value, { patch: true }); }

    $get() {
        if (!this.#isObject) {
            return this.#value;
        } else {
            const value = this.#value ??= Object.create(null);
            const result = Object.create(null);
            for (const key in value) result[key] = value[key].value;
            return result;
        }
    }
    $set(value, options) {
        const oldValue = this.#value;

        if (this.constructor.isPrimitive(value)) {
            const equal = this.#isObject === false && this.constructor.equals(oldValue, value); 
            if (!equal) {
                if (this.#isObject) this.#clearChildren();
                this.#value = value;
                this.#isObject = false;
                dispatch(this, "change", { oldValue, value });
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


    #clearChildren() {
        for (const child of Object.values(this.#value)) {
            //child.dead = true; not used for now
            child.clear();
        }
    }

    clear() {
        if (this.#isObject) this.#clearChildren();
        this.#value = undefined;
        this.#isObject = null;
        this.#io?.dispose();
        this.#io = null;
    }

    /* object related */

    item(key) {
        key = String(key);
        if (!this.#isObject) this.#value = Object.create(null);
        this.#isObject = true;
        if (!(key in this.#value)) {
            if (this.ChildClass === false) throw new Error(`${this.constructor.name} has no children`);
            const Klass = this.ChildClass ?? this.constructor;
            const item = new Klass(this, key);
            this.#value[key] = item;
            dispatch(this, "change", { add: item });
        }
        return this.#value[key];
    }

    sub(...keys) {
        let current = this;
        for (const key of keys.flat()) current = current.item(key);
        return current;
    }

    remove() {
        if (!this.#parent) throw new Error("cannot remove root item");
        delete this.#parent.#value[this.#key];
        dispatch(this.#parent, "change", { remove: this });
    }

    has(key) {
        track(this);
        return this.#isObject && key in this.#value ? this.item(key) : undefined;
    }

    get keys() {
        track(this);
        return this.#isObject ? Object.keys(this.#value ?? {}) : EMPTY_ARRAY;
    }
    get path() {
        return this.#path ??= this.#parent == null ? EMPTY_ARRAY : [...this.#parent.path, this.key];
    }
    get root() { return this.#root ??= this.#parent?.root ?? this; }

    *[Symbol.iterator]() {
        for (const key of this.keys) yield this.#value[key];
    }

    items() {
        track(this);
        if (this.#isObject !== true) return EMPTY_ARRAY;
        return Object.values(this.#value);
    }

    /* AsyncDataPoint (beta) */
    #io = null;

    get io() {
        if (!this.#io) {
            this.#io = new AsyncDataPoint({
                get: (signal) => this.reader(signal),
                set: (v, signal) => this.writer(v, signal),
            });
            this.#io.onchange = ({value, error}) => {
                if (error) return dispatch(this, "change", { error });
                if (value === undefined) return; // reader adds subitems by itself
                this.set(value, {patch: true});
            }
            this.#io.onpending = () => dispatch(this, "change", { pending: true });
        }
        return this.#io;
    }

    async read()  {
        if (this.reader) await this.io.get();
        return this.get();
    }

    async *[Symbol.asyncIterator]() {
        for (const item of Object.values(this.#value ?? {})) yield item;
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, "change", { signal: abortCtrl.signal });
        this.read().then(() => abortCtrl.abort()); // hm... read will call get but should only create direct child-items...
        for await (const { detail: { add } } of iterator) if (add) yield add;
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
        for await (const { detail: { add } } of iterator) {
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

    /**
     * Assign a JSON Schema to this item. Throws if any ancestor already has a schema.
     * @param {Object} schema - A valid JSON Schema object.
     */
    setSchema(schema) {
        for (let p = this.#parent; p; p = p.#parent) {
            if (p.#schema) throw new Error(`ancestor "${p.path.join('.')}" already has a schema`);
        }
        this.#schema = schema;
    }

    /**
     * The effective JSON Schema for this item, inherited from the nearest ancestor schema
     * via properties, items, or additionalProperties traversal.
     * @type {Object|null}
     */
    get schema() {
        if (this.#schema != null) return this.#schema;
        const parentSchema = this.#parent?.schema;
        if (!parentSchema) return null;
        return parentSchema.properties?.[this.#key] ?? parentSchema.items ?? parentSchema.additionalProperties ?? null;
    }
    set schema(v) { throw new Error('use setSchema() to assign a schema'); }


    /* misc */

    get proxy() { return toProxy(this); }

    toJSON() { return this.get(); }
    valueOf() { return this.get(); }

    toString() {
        if (this.#isObject) {
            track(this); // needed: item could change from object to primitive
            return this.#key ?? "";
        }
        return String(this.get() ?? "");
    }

    [Symbol.toPrimitive](hint) {
        if (hint === "string") return this.toString();
        const value = this.#isObject ? this.#key : this.get();
        if (hint === "number") return Number(value);
        return this.#value;
    }

    ChildClass = this.constructor.ChildClass;

    /** @beta Metadata slot for drivers/subclasses. Not reactive. Consistency is the driver's responsibility. */
    meta = null;

    /* static members */

    static isPrimitive(value) { return value !== Object(value); }

    static equals(a, b) { return Object.is(a, b); } // question: should use deepEqual as "primitive" can be an object?

    static ChildClass;
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


/**
 * Dispatch a custom event on the item and its ancestors.
 * @param {Item} item - The item to dispatch the event on.
 * @param {string} eventName - The name of the event. eventName+"In" will be dispatched on the ancestors. (bubbles)
 * @param {Object} detail - The event details.
 * @return {Object} An object containing a `defaultPrevented` property.
 */
export function dispatch(item, eventName, detail) {
    const event = new ItemEvent(eventName, detail);
    item.dispatchEvent(event);
    event.type = eventName+'In'; // reuse event object
    for (let i = item; i; i = i.parent) i.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented };
}
