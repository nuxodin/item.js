
export class Item extends EventTarget {

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

    get value(){

        const eventOptions = {detail: { item: this }};
        this.dispatchEvent(new CustomEvent('get', eventOptions));
        this.dispatchEventBubble(new CustomEvent('getIn', eventOptions));

        if (this.constructor.isPrimitive(this.#value)) {
            return this.#value;
        } else {
            return Object.fromEntries(Object.entries(this.#value).map(([key, {value}]) => [key, value]));
        }
    }
    set value(value){

        if (value instanceof Item) value = value.value;

        if (this.constructor.isPrimitive(value)) {
            if (this.#value !== value) {

                const eventOptions = {detail: { item: this, oldValue: this.#value, newValue: value }};
                this.dispatchEvent(new CustomEvent('set', eventOptions));
                this.dispatchEventBubble(new CustomEvent('setIn', eventOptions));

                this.#value = value;
            }
        } else {
            for (const key of Object.keys(value)) {
                this.item(key).value = value[key];
            }
        }
    }
    item(key){
        //this.#value ??= {};
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

}

export const item = (...args) => new Item(...args);



// todo: signalize
// const effects = [];
// const disposes = new WeakMap;
// const dispatch = effects => {
//   for (const effect of new Set(effects)) effect();
// };

// let batches = effects;

// export function signalize(){
//     const item = new Item();
//     item.effects = [];

//     item.addEventListener('getIn', e => {
//         const {item} = e.detail;
//         const {length} = effects;
//         if (length) item.effects.push(effects[length - 1]);
//     });

//     item.addEventListener('setIn', e => { // after setIn?
//         const {item} = e.detail;
//         if (item.effects.length) {
//             if (batches === effects) dispatch(item.effects.splice(0));
//             else batches.push(...item.effects.splice(0));
//         }
//     });
// }

export function attacheJsonSchema(root, schema){

    root.addEventListener('setIn', e => {
        const {item, newValue} = e.detail;

        if (schema.type === 'object') {
            if (typeof newValue !== 'object') throw new Error('value must be an object');
            for (const [key, value] of Object.entries(newValue)) {
                if (!schema.properties[key]) throw new Error(`property ${key} is not allowed`);
                attacheJsonSchema(item.item(key), schema.properties[key]);
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(newValue)) throw new Error('value must be an array');
            for (const [index, value] of newValue.entries()) {
                attacheJsonSchema(item.item(index), schema.items);
            }
        } else if (schema.type === 'string') {
            if (typeof newValue !== 'string') throw new Error('value must be a string');
        } else if (schema.type === 'number') {
            if (typeof newValue !== 'number') throw new Error('value must be a number');
        } else if (schema.type === 'boolean') {
            if (typeof newValue !== 'boolean') throw new Error('value must be a boolean');
        } else if (schema.type === 'null') {
            if (newValue !== null) throw new Error('value must be null');
        } else if (schema.type === 'any') {
            // nothing
        } else {
            throw new Error('unknown type');
        }


    });


}


const proxyHandler = {
    get: function(target, property, receiver){
        if (typeof property === 'symbol') return Reflect.get(target, property, receiver);
        if (property === '$item') return target;
        const item = target.item(property);

        // todo: accessing item.value here is not good, it will trigger a get event (E.g. fetch data)
        if (item.constructor.isPrimitive(item.value)) {
            return item.value;
        } else {
            return proxify(item);
        }
    },
    set: function(target, property, value, receiver){
        //target.item(property).value = value;
        return true;
    }
};
export function proxify(item){
    const proxy = new Proxy(item, proxyHandler);
    return proxy;
}






/* *
export function denoFs(rootPath) {
    const root = item();

    const watcher = Deno.watchFs(rootPath);

    for await (const event of watcher) {
        // Example event: { kind: "create", paths: [ "/home/alice/deno/foo.txt" ] }
        // get the path within the root
        for (const path of event.paths) {
            // get the path relative to the root
            const relativePath = path.substring(rootPath.length + 1);
            const pathArray = relativePath.split('/');
            root.walkPathArray(pathArray).value = null; // trigger get, todo
        }
    }

    root.addEventListener('setIn', e => {
        const {item, newValue} = e.detail;
        Deno.writeTextFile(rootPath + '/' + item.path, newValue);
    });

    root.addEventListener('getIn', e => {
        const {item} = e.detail;
        const value = Deno.readTextFile(rootPath + '/' + item.path); //  promise
        item.value = value;
    });

    return root;
}
/* */