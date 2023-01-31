import { Item, dispatchEvent } from "../item.js";
import { AsyncDataPoint } from "./AsyncDataPoint.js";

export class AsyncItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.master = new AsyncDataPoint({
            get: () => this.createGetter(),
            set: value => this.createSetter(value)
        });
        this.master.onchange = ({value, oldValue}) => {
            dispatchEvent(this, 'change', { item: this, value, oldValue });
        }
    }
    createGetter() { throw new Error('createGetter not implemented'); }
    createSetter(value) { throw new Error('createSetter not implemented (value: ' + value + ')'); }

    $get() {
        return this.master.get();
    }
    $set(value) {
        this.master.set(value);
    }
    item = null // overwrite asyncItems can not have items
}
