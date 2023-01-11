

export class Item extends EventTarget {
    constructor(parent, key, value){
        super();
        this.parent = parent;
        this.key = key;
        this.base = parent === null ? this : parent;
        this.$data = value;
    }
    get value(){
        return this.$data;
    }
    set value(value){
        if (value !== Object(value)) {
            if (this.$data !== value) {

                const eventOptions = {detail: {
                    item: this,
                    oldValue: this.$data,
                    newValue: value,
                }};
                this.dispatchEvent(new CustomEvent('change', eventOptions));
                this.dispatchEventBubble(new CustomEvent('changein', eventOptions));

                this.$data = value;
            }
        } else {
            this.$data ??= {};
            for (const key in value) {
                //this.$data[key] = new this.constructor(this, key, value[key]);
                this.item(key).value = value[key];
            }
        }
    }
    item(key){
        this.$data ??= {};
        this.$data[key] ??= new this.constructor(this, key);
        return this.$data[key];
    }

    dispatchEventBubble(event){
        super.dispatchEvent(event);
        if (this.parent != null) {
            this.parent.dispatchEvent(event);
        }
    }
    toJSON() { return this.$data }
    valueOf() { return this.$data }
    //then() { return this.value }
    //toString() { return String(this.$data) }
}


// localStorageItem example
class localStorageItem extends Item {
    constructor(parent, key, value){
        if (parent == null) {
            addEventListener('storage', e => {
                this.item(e.key).value = e.newValue;
            });
        }
        super(parent, key, value);
    }
    get value(){
        return localStorage.getItem(this.key);
    }
    set value(value){
        localStorage.setItem(this.key, value);
    }
}
export const localStorageInstance = new localStorageItem(null);





/*
export class BaseItem {
    constructor(data){
        $this.$data(data);
    }
    set data(value){
        this.$data = value;
    }
    get data(){
        return this.$data;
    }
}


export class Item extends BaseItem {
    constructor(data, parent, key){
        super(data);
        this.parent = parent;
        this.key = key;
        this.base = parent === null ? this : parent;
    }
    set data(value){
        if (value !== Object(value)) {
            this.$data = value;
        } else {
            if (this.$data == null) this.$data = {};
            for (var key in value) {
                this.$data[key] = new this.constructor(this, key);
                this.$data[key].$data = value[key];
            }
        }
    }
}

export class PathItem extends Item {
    static separator = '/';
    constructor(data, parent, key){
        super(data, parent, key);
    }
    get path() {
        return this.parent.path + PathItem.separator + this.key;
    }
}

export class EventedItem extends PathItem {
    constructor(data, parent, key){
        super(data, parent, key);
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
    constructor(data, parent, key){
        super(data, parent, key);
        this.pending = false;
        this.promiseChain = [];
    }
    set data(value){
        super.$data = value;
        this.emit('change', this);
    }
    get data(){
        this.emit('get', this);
        return super.$data;
    }
}



export function proxify(item){
    var proxy = new Proxy(item, {
        get: function(target, property, receiver){
            return target.$data[property];
        },
        set: function(target, property, value, receiver){
            target.$data[property] = value;
            return true;
        }
    });
    return proxy;
}
*/