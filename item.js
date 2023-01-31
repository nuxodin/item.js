// import { AsyncMaster } from "./drivers/AsyncMaster.js";
// export class asyncItem extends Item {
//     constructor(parent, key) {
//         super(parent, key);
//         this.master = new AsyncMaster({get:this.asyncGet, set:this.asyncSet});
//         this.addEventListener("get", ({ detail }) => {
//             detail.item.value = this.master.get(); // bad: triggers set
//         });
//         this.addEventListener("set", ({ detail: { value } }) => {
//             this.master.set(value);
//             detail.preventChange = true;
//         });
//         master.onchange = (value) => {
//             dispatchEvent(this, "change", { item: this, value:value });
//         });
//     }
// }


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
    }

    get key(){ return this.#key }
    get parent(){ return this.#parent }
    get filled(){ return this.#filled }

    get value(){
        if (this.#isgetting) throw new Error('circular get');
        this.#isgetting = true;
        dispatchEvent(this, 'get', { item: this, value:this.#value });
        this.#isgetting = false;
        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            return Object.fromEntries(Object.entries(this.#value).map(([key, {value}]) => [key, value]));
        }
    }
    set value(value){
        if (this.#issetting) throw new Error('circular set');
        this.#issetting = true;

        if (value instanceof Item) value = value.value;

        const oldValue = this.#value;

        dispatchEvent(this, 'set', { item:this, oldValue , value });

        if (this.constructor.isPrimitive(value)) {
            if (!this.#filled || this.#value !== value) {
                this.#value = value;
                this.#filled = true;
                if (!this.#isgetting) {
                    dispatchEvent(this, 'change', { item: this, oldValue, value });
                } else {
                    console.warn('just for your info: set while getting dont trigger change');
                }
            }
        } else {
            for (const key of Object.keys(value)) this.item(key).value = value[key];
        }
        this.#issetting = false;
    }
    item(key){
        if (this.constructor.isPrimitive(this.#value)) {
            this.#value = Object.create(null);
            this.#filled = true;
        }
        const Klass = this.constructor.childClass??this.constructor;
        this.#value[key] ??= new Klass(this, key);
        return this.#value[key];
    }
    static childClass;

    toJSON() { return this.value; }
    then(fn) { fn(this.value); }
    valueOf() { return this.value; }
    toString() { String(this.value); }

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

    static pathSeparator = '/';
    get pathString() {
        if (this.#parent == null) return '';
        return this.pathKeys.join(this.constructor.pathSeparator);
    }

    static isPrimitive(value){
        return value !== Object(value) || 'toJSON' in value || value instanceof Promise;
    }
}

export const item = (...args) => {
    const v = new Item();
    if (args.length > 0) v.value = args[0];
    return v;
}

function dispatchEvent(item, eventName, detail){
    const options = {detail};
    item.dispatchEvent(new CustomEvent(eventName, options));

    let current = item;
    while (current) {
        current.dispatchEvent(new CustomEvent(eventName + 'In', options));
        current = current.parent;
    }
}


// todo: signalize



const proxyHandler = {
    get: function(target, property, receiver){
        if (typeof property === 'symbol') return Reflect.get(target, property, receiver);
        if (property === '$item') return target;
        const item = target.item(property);

        // todo: accessing item.value here is not good, it will trigger a get event (E.g. fetch data)
        if (item.constructor.isPrimitive(item.value)) {
            return item.value;
        } else {
            return proxy(item); // todo: cache it?
        }
    },
    set: function(target, property, value, receiver){
        target.item(property).value = value;
        return true;
    }
};
export function proxy(arg){
    if (arg instanceof Item) return new Proxy(arg, proxyHandler);
    else return new Proxy(item(arg), proxyHandler);
}
