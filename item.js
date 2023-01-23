
export class Item extends EventTarget {

    #value;
    #parent;
    #key;
    //#base;

    constructor(value, parent, key){
        if (parent != null) {
            if (!(parent instanceof Item)) throw new Error('parent must be an instance of Item') ;
            if (!(typeof key === 'string')) throw new Error('key must be a string');
        }
        super();
        this.value = value;
        this.#parent = parent;
        this.#key = key;
        //this.#base = parent === null ? this : parent;
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
            const v = {};
            for (const key in this.#value) v[key] = this.#value[key].value;
            return v;
            // return Object.fromEntries(Object.entries(this.#value).map(([key, {value}]) => [key, value])); // better?
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
    static pathSeparator = '/';
    // todo? should path look like "/a/b/c" or "a/b/c"?
    // what if the key contains a slash?
    get path() {
        if (this.#parent == null) return '';
        return this.pathArray.join(this.constructor.pathSeparator);
    }
    get pathArray() {
        if (this.#parent == null) return [];
        return [...this.#parent.pathArray, this.key];
    }
    walkPathArray(pathArray) {
        if (pathArray.length === 0) return this;
        return this.item(pathArray[0]).walkPathArray(pathArray.slice(1));
    }

    get pathLevel() {
        if (this.#parent == null) return 0;
        return this.#parent.pathLevel + 1;
    }
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
        target.item(property).value = value;
        return true;
    }
};
export function proxify(item){
    const proxy = new Proxy(item, proxyHandler);
    return proxy;
}


// localStorageItem

class localStorageItem extends Item {
    constructor(value, parent, key){
        super(value, parent, key);
        if (parent == null) {
            addEventListener('storage', e => {
                this.item(e.key).value = e.newValue;
            });
        } else {
            this.addEventListener('set', e => {
                localStorage.setItem(this.key, e.detail.newValue);
            });
            this.addEventListener('get', () => {
                this.value = localStorage.getItem(this.key);
            });
        }
    }
}
export const localStorageInstance = new localStorageItem();


// BroadcastChannel
export function broadcastChannelItem(channelName, {init=null}={}) {
    const channel = new BroadcastChannel(channelName);
    const root = item();
    root.addEventListener('setIn', e => {
        const {item, newValue} = e.detail;
        channel.postMessage({path: item.pathArray, newValue});
    });

    channel.postMessage({getInitial: true});

    // now wait for the response and if it doesn't come, set the initial value
    setTimeout(async () => {
        if (init && root.value == null) {
            const value = await init(); // request initial value
            if (root.value == null) root.value = value; // if it's still null, set it
        }
    }, 1000);

    channel.onmessage = e => {

        if (e.data.getInitial) {
            channel.postMessage({setInitial: root.value});
            return;
        }
        if (e.data.setInitial) {
            root.value = e.data.setInitial;
            return;
        }

        const {path, newValue} = e.data;

        root.walkPathArray(path).value = newValue;

    };
    return root;
}


// restApi
export function restApi(url, options){
    const root = item();
    root.addEventListener('setIn', e => {
        // throw new Error('not implemented');
        // item.getPromise = null; // bad, get is called inside set
        console.log('setIn', e.detail.item.path);
    });
    root.addEventListener('getIn', e => {
        const item = e.detail.item;

        if (item.getPromise) return; // already fetched or fetching

        const headers = new Headers();
        if (options?.auth) {
            const {username, password} = options.auth;
            headers.append('Authorization', 'Basic' + base64.encode(username + ":" + password));
        }

        const promise = fetch(url + '/' + item.path, {headers}).then(response => {
            const value = response.json();
            item.value = value; // no more a promise, trigger setter to update
            return value;
        });


        item.value = promise;
        item.getPromise = promise;
    });
    return root;
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