import { Item, dispatchEvent } from "../item.js";
import { AsyncDataPoint } from "./AsyncDataPoint.js";

export class AsyncItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.master = new AsyncDataPoint({
            get: () => this.createGetter(),
            set: (value, abortSignal) => this.createSetter(value, abortSignal)
        });
        this.master.onchange = ({value, oldValue}) => {
            dispatchEvent(this, 'change', { item: this, value, oldValue });
        }

        // TODO: changes in child items should be handled (get the actual value and make a patch from the change inside)
    }
    createGetter() { throw new Error('createGetter not implemented'); }
    createSetter(value) { throw new Error('createSetter not implemented (value: ' + value + ')'); }

    $get() {
        return this.master.get();
    }
    $set(value) {
        this.master.set(value);
    }
    ChildClass = AsyncChild;
}


// TODO:
export class AsyncChild extends AsyncItem {
    createGetter() {
        return this.parent.value.then(row => {
            row ??= Object.create(null);
            return row[this.key];
        });
    }
    createSetter(value) {
        return this.parent.value.then( row => {
            row ??= Object.create(null);
            row[this.key] = value;
            // structuredClone is needed to make the row a new object.
            // TODO: we need to deep compare the old and new row to avoid unnecessary updates
            return this.parent.value = structuredClone(row);
        });
    }
}
