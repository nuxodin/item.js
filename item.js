

export class Item extends EventTarget {

    #value;
    #parent;
    #key;
    #base;

    constructor(value, parent, key){
        super();
        this.#value = value;
        this.#parent = parent;
        this.#key = key;
        this.#base = parent === null ? this : parent;
    }
    get key(){ return this.#key }
    get parent(){ return this.#parent }

    //get silent(){ return this.#value; }
    //set silent(value){ this.#value = value; }

    get value(){ return this.#value; }
    set value(value){
        if (value !== Object(value)) {
            if (this.#value !== value) {

                const eventOptions = {detail: {
                    item: this,
                    oldValue: this.#value,
                    newValue: value,
                }};
                this.dispatchEvent(new CustomEvent('change', eventOptions));
                this.dispatchEventBubble(new CustomEvent('changein', eventOptions));

                this.#value = value;
            }
        } else {
            //this.#value ??= {};
            for (const key in value) {
                //this.#value[key] = new this.constructor(value[key], this, key);
                this.item(key).value = value[key];
            }
        }
    }
    item(key){
        this.#value ??= {};
        this.#value[key] ??= new this.constructor(undefined, this, key);
        return this.#value[key];
    }

    dispatchEventBubble(event){
        super.dispatchEvent(event);
        if (this.#parent != null) {
            this.#parent.dispatchEvent(event);
        }
    }
    toJSON() { return this.#value }
    valueOf() { return this.#value }
    //then() { return this.value }
    //toString() { return String(this.#value) }
}


// localStorageItem example
class localStorageItem extends Item {

    #key;

    constructor(parent, key, value){
        if (parent == null) {
            addEventListener('storage', e => {
                this.item(e.key).value = e.newValue;
            });
        }
        super(parent, key, value);
    }
    get value(){
        return localStorage.getItem(this.#key);
    }
    set value(value){
        localStorage.setItem(this.#key, value);
    }
}
export const localStorageInstance = new localStorageItem(null);





/*
export class BaseItem {

    #value;

    constructor(value){
        this.value(value);
    }
    set value(value){
        this.#value = value;
    }
    get value(){
        return this.#value;
    }
}


export class Item extends BaseItem {
    constructor(value, parent, key){
        super(value);
        this.#parent = parent;
        this.#key = key;
        this.#base = parent === null ? this : parent;
    }
    set value(value){
        if (value !== Object(value)) {
            this.#value = value;
        } else {
            if (this.#value == null) this.#value = {};
            for (var key in value) {
                this.#value[key] = new this.constructor(this, key);
                this.#value[key].#value = value[key];
            }
        }
    }
}

export class PathItem extends Item {
    static separator = '/';
    constructor(value, parent, key){
        super(value, parent, key);
    }
    get path() {
        return this.#parent.path + PathItem.separator + this.#key;
    }
}

export class EventedItem extends PathItem {
    constructor(value, parent, key){
        super(value, parent, key);
    }
    on(event, callback){
        if (this.$events == null) this.$events = {};
        if (this.$events[event] == null) this.$events[event] = [];
        this.$events[event].push(callback);
    }
    off(event, callback){
        if (this.$events == null) return;
        if (this.$events[event] == null) return;
        var index = this.$events[event].indexOf(callback);
        if (index > -1) this.$events[event].splice(index, 1);
    }
    emit(event, ...args){
        if (this.$events == null) return;
        if (this.$events[event] == null) return;
        for (var i = 0; i < this.$events[event].length; i++) {
            this.$events[event][i].apply(this, args);
        }
    }
}

// items that can be syncted by a master
export class SlaveItem extends EventedItem {
    constructor(value, parent, key){
        super(value, parent, key);
        this.pending = false;
        this.promiseChain = [];
    }
    set value(value){
        super.#value = value;
        this.emit('change', this);
    }
    get value(){
        this.emit('get', this);
        return super.#value;
    }
}



export function proxify(item){
    var proxy = new Proxy(item, {
        get: function(target, property, receiver){
            return target.#value[property];
        },
        set: function(target, property, value, receiver){
            target.#value[property] = value;
            return true;
        }
    });
    return proxy;
}
*/