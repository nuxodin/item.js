
class Item extends EventTarget {

    #value;
    #parent;
    #key;

    constructor(value, parent, key){
        if (parent != null) {
            if (!(parent instanceof Item)) throw new Error('parent must be an instance of Item') ;
            if (!(typeof key === 'string')) throw new Error('key must be a string');
        }
        super();
        this.value = value;
        this.#parent = parent;
        this.#key = key;
    }
    get key(){ return this.#key }
    get parent(){ return this.#parent }

    #setterForbiden = false;

    get value(){

        this.#setterForbiden = true;
        const eventOptions = {detail: { item: this }};
        this.dispatchEvent(new CustomEvent('get', eventOptions));
        this.dispatchEventBubble(new CustomEvent('getIn', eventOptions));
        this.#setterForbiden = false;

        if ('setValue' in eventOptions.detail) {
            this.#value = eventOptions.detail.setValue;
            this.#value;
        }

        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            return Object.fromEntries(Object.entries(this.#value).map(([key, {value}]) => [key, value]));
        }
    }
    set value(value){

        if (this.#setterForbiden) throw new Error('cannot set value while getting it');
        if (value instanceof Item) value = value.value;

        if (this.#value === value) return;

        const oldValue = this.#value;
        const eventOptions = {detail: { item: this, oldValue, newValue: value }};
        this.dispatchEvent(new CustomEvent('set', eventOptions));
        this.dispatchEventBubble(new CustomEvent('setIn', eventOptions));

        if (this.constructor.isPrimitive(value)) {
            if (this.#value !== value) this.#value = value;
        } else {
            for (const key of Object.keys(value)) {
                this.item(key).value = value[key];
            }
        }
    }
    item(key){
        if (this.constructor.isPrimitive(this.#value)) this.#value = Object.create(null);
        this.#value[key] ??= new this.constructor(undefined, this, key);
        return this.#value[key];
    }

    dispatchEventBubble(event){
        this.dispatchEvent(event);
        this.parent && this.parent.dispatchEventBubble(event);
    }

    toJSON() { return this.value }
    valueOf() { return this.value }
    then(fn) { fn(this.value); }
    toString() { return String(this.value) }

    // todo: i think is object would be better
    // should it be at the instance level?
    static isPrimitive(value){
        return value !== Object(value) || 'toJSON' in value || value instanceof Promise;
        // better like this? return value == null || primitives[typeof value] || 'toJSON' in value;
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

    static pathSeparator = '/';
    // todo? should path look like "/a/b/c" or "a/b/c"?
    // what if the key contains a slash?
    get pathString() {
        if (this.#parent == null) return '';
        return this.pathKeys.join(this.constructor.pathSeparator);
    }
    // get pathLevel() {
    //     if (this.#parent == null) return 0;
    //     return this.#parent.pathLevel + 1;
    // }



    // promise to trigger "set" when it gets fullfilled?
    // setPromise(promise){
    //     this.#value = promise;
    //     promise.then(value => {
    //         if (this.#value !== promise) return; // if the promise has been replaced
    //         const oldValue = this.#value;
    //         const eventOptions = {detail: { item: this, oldValue, newValue: value }};
    //         this.dispatchEvent(new CustomEvent('set', eventOptions));
    //         this.dispatchEventBubble(new CustomEvent('setIn', eventOptions));
    //     });
    // }

}

export const item = (...args) => new Item(...args);



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
            return proxify(item); // todo: cache it?
        }
    },
    set: function(target, property, value, receiver){
        target.item(property).value = value;
        return true;
    }
};
export function proxify(item){
    const proxy = new Proxy(item, proxyHandler);
    return proxy;
}
