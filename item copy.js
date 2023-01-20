


export class Item {

    #value;

    static mixins = [];

    constructor(value){
        for (const mixin of this.constructor.mixins) mixin.init(this, arguments);
        this.#value = value;
    }
    get value(){
        for (const mixin of this.constructor.mixins) mixin.get(this);
        return this.#value;
    }
    set value(value){
        for (const mixin of this.constructor.mixins) mixin.set(this, value);
        this.#value = value;
    }
    toJSON() { return this.value }
    valueOf() { return this.value }
    then() { return this.value }
    toString() { return String(this.value) }
}
