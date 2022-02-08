
export class Item {
    constructor(parent, key){
        this.$parent = parent;
        this.$key = key;
        this.$base = parent === null ? this : parent;
    }
    set data(value){
        if (value !== Object(value)) {
            this.$data = value;
        } else {
            if (this.$data == null) this.$data = {};
            for (var key in value) {
                this.$data[key] = new this.constructor(this, key);
                this.$data[key].data = value[key];
            }
        }
    }
    get data(){
        return this.$data;
    }

}
