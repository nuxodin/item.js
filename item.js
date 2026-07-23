// @ts-self-types="./item.d.ts"
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
    #isGetting = false;
    
    constructor(parent, key) {
        super();
        this.#parent = parent ?? null;
        this.#key = key ?? null;
    }

    get key()        { return this.#key; }
    get parent()     { return this.#parent; }
    get filled()     { return this.#isObject !== null; }
    get isObject()   { return this.#isObject; }
    set value(value) { this.set(value); }
    get value()      { return this.get(); }

    get(options) {
        const value = this.$get(options);
        if (options?.silent) return value;
        if (this.#isGetting) throw new Error("[item.js] circular get");
        this.#isGetting = true;
        try {
            const event = dispatch(this, 'get', { value, options });
            track(this);
            return event.defaultPrevented ? undefined : event.value;
        } finally {
            this.#isGetting = false;
        }
    }

    $get(options) {
        if (!this.#isObject) return this.#value;
        const depth = options?.depth ?? Infinity;
        const value = this.#value;
        const result = Object.create(null);
        for (const key in value) {
            result[key] = depth > 1 ? value[key].get({ ...options, depth: depth - 1 }) : null;
        }
        return result;
    }

    peek() { return this.get({ silent: true }); }

    /** Returns a promise while an io-write is running, else undefined (no writer, local, unchanged
     *  or prevented). Await it to know *when* the write landed — not *what* it resolves to. */
    set(value, options) {
        if (this.#isSetting) throw new Error("[item.js] circular set");
        this.#isSetting = true;
        try {
            const event = dispatch(this, "set", {oldValue: this.#value, value, options});
            let ioPromise = undefined;
            if (!event.defaultPrevented) {
                value = event.value;

                const owner = options?.local ? null : this.ioOwner;

                // `set` on the owner itself is a deliberate full replace — everything else is partial
                if (owner !== this || options?.patch) this.#assertRegionLicence(owner);

                this.$set(value, { ...options, local: options?.local || !!owner?.writer }); // children "local only" — the owner writes them

                if (owner?.writer) ioPromise = owner.io.set(owner.peek());

            }
            return ioPromise;
        } finally {
            this.#isSetting = false;
        }
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

    clear() {
        if (this.#isObject) this.#clearChildren();
        this.#io?.dispose();
        this.removeAllListeners();
        this.#value = undefined;
        this.#isObject = this.#io = this.#path = this.#root = null;        
    }

    /* object related */

    #clearChildren() {
        for (const child of Object.values(this.#value)) child.clear();
    }

    #ensureObject() {
        if (!this.#isObject) {
            //dispatch(this, "change", { oldValue:this.#value, value:null }); // null ok?
            this.#value = Object.create(null);
            this.#isObject = true;
        }
    }

    item(key) {
        key = String(key);
        this.#ensureObject();
        if (!(key in this.#value)) {
            if (this.ChildClass === false) throw new Error(`[item.js] ${this.constructor.name} has no children`);
            const Klass = this.ChildClass ?? this.constructor;
            const item = new Klass(this, key);
            this.#value[key] = item;
            dispatch(this, "change", { add: item });
        }
        return this.#value[key];
    }

    async add(value) {
        const key = this.adder ? (await this.adder(value)).key : this.generateKey();
        if (key == null) throw new Error("[item.js] a key must be generated");
        if (this.has(key)) throw new Error(`[item.js] key "${key}" already exists`)
        const item = this.item(key);
        item.set(value, { local: true });
        return item;
    }

    generateKey() { return crypto.randomUUID() } // items with no ".adder()"

    async remove(options) {
        if (!this.#parent) throw new Error("[item.js] cannot remove root item");
        // no own remover → the removal is a partial write of the surrounding region
        const owner = options?.local || this.remover ? null : this.#parent.ioOwner;
        this.#assertRegionLicence(owner);
        delete this.#parent.#value[this.#key];
        dispatch(this.#parent, "change", { remove: this, options });
        if (this.remover && !options?.local) await this.remover();
        else if (owner?.writer) await owner.io.set(owner.peek());
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
                get: async (signal) => {
                    const data = await this.reader(null, {signal});
                    // declared full but delivered shallow → reject, so the region stays unloaded
                    if (this.readsFull && data?.value !== undefined && ![true, Infinity].includes(data.depth)) throw new Error(`[item.js] "${this.path.join('.')}" declares readsFull but its reader delivered depth ${data.depth}`);
                    return data;
                },
                set: (v, signal) => this.writer(v, {signal}),
            });
            if (this.#parent?.#io) this.#io.options = this.#parent.#io.options;
            this.#io.onchange = ({value, error}) => {
                if (error) return dispatch(this, "change", { error });
                this.#onReceiveData(value);
            }
            this.#io.onpending = () => dispatch(this, "change", { pending: true });
        }
        return this.#io;
    }

    /** Item talking to the source for this one — itself, else the nearest ancestor with a hook. */
    get ioOwner() {
        if (this.reader || this.writer) return this;
        return this.#parent?.ioOwner ?? null;
    }

    /** A partial write sends the owner's WHOLE region — only sound if that region is complete. */
    #assertRegionLicence(owner) {
        if (!owner?.writer || !owner.reader) return; // writer-only: the tree is the only truth
        const why = !owner.readsFull ? 'does not declare readsFull' : !owner.loaded ? 'is not loaded, await read() first' : null;
        if (why) throw new Error(`[item.js] cannot partially write "${this.path.join('.')}" — its io owner ${why}`);
    }

    async read(query) {
        if (!query) return (this.reader || this.#io?.isPending) ? await this.io.get() : false;
        // a query is a slice: bypasses io (io is always the whole value), patches, never marks loaded
        if (!this.reader) throw new Error('[item.js] read(query) requires a reader');
        const data = await this.reader(query);
        this.#onReceiveData(data, { patch: true });
        return data;
    }
    #onReceiveData(data, opts) {
        // if (query?.depth && query.depth !== data.depth) console.log("reader depth mismatch", query.depth, data.depth);
        if (data === undefined) return;
        if (data?.depth !== undefined && data?.value !== undefined) {
            const depth = data.depth === true ? Infinity : data.depth;
            this.set(data.value, { local: true, depth, ...opts });
        } else {
            // A readsFull owner promises its reader delivers the whole region — merge deep.
            this.set(data, { local: true, depth: this.readsFull ? Infinity : 1, ...opts });
        }
    }
    async *[Symbol.asyncIterator]() {
        for (const item of Object.values(this.#value ?? {})) {
            if (!this.isObject) return; // no longer an object (or cleared)
            yield item;
        }
        if (!this.isObject) return; // no longer an object (or cleared)
        const abortCtrl = new AbortController();
        const iterator = asyncIteratorFromEventTarget(this, "change", { signal: abortCtrl.signal });
        this.read().then(() => abortCtrl.abort());
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
    /** Did the region value ever arrive? An io statement, unlike `filled` (local tree, set by navigation). */
    get loaded()         { track(this); const o = this.ioOwner; return (o === this ? this.#io?.isLoaded : o?.loaded) ?? false; }

    /* JSON Schema */

    #schema = null;

    setSchema(schema) {
        for (let p = this.#parent; p; p = p.#parent) {
            if (p.#schema) throw new Error(`[item.js] ancestor "${p.path.join('.')}" already has a schema`);
        }
        this.#schema = schema;
    }

    get schema() {
        if (this.#schema != null) return this.#schema;
        const p = this.#parent?.schema;
        if (!p) return null;
        const k = this.#key;
        return (
            p.properties?.[k] ??
            Object.entries(p.patternProperties ?? {}).find(([pat]) => new RegExp(pat).test(k))?.[1] ??
            (/^\d+$/.test(k) ? p.items : undefined) ??
            p.additionalProperties ??
            null
        );
    }

    set schema(v) { throw new Error('[item.js] use setSchema() to assign a schema'); }

    /* misc */

    get proxy() { return toProxy(this); }

    toJSON()   { return this.get(); }
    toString() {
        if (this.#isObject) { track(this); return this.#key ?? ""; }
        return String(this.get() ?? "");
    }
    valueOf() { return this[Symbol.toPrimitive](); }
    [Symbol.toPrimitive](hint) {
        if (hint === "string") return this.toString();
        const value = this.#isObject ? this.#key : this.get();
        return hint === "number" ? Number(value) : value;
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
