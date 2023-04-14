import { Item, dispatchEvent } from "../item.js";
import { AsyncDataPoint } from "./AsyncDataPoint.js";

/*
A AsyncItem is a Item that can be get and set asynchronously.
When you get (or set) the value of a AsyncItem, it will return a Promise.
value = await item.get()
await item.set(value) // await is optional, use it if you want to wait for the set to finish
*/
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
    }
    createGetter() { throw new Error('createGetter not implemented'); }
    createSetter(value) { throw new Error(`createSetter not implemented (value: ${value})`); }

    $get() {
        return this.master.get();
    }
    $set(value) {
        return this.master.set(value);
    }
    // static ChildClass is set after its class definition
}

/*
A AsyncChild is a child of a AsyncItem.
If you set a value in a AsyncChild, it will first get the value from the parent, modify it and then set it back.
Same for remove.
*/
export class AsyncChild extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        this.master.options = this.parent.master.options; // same options as parent
    }
    async createGetter() {
        let row = await this.parent.get();
        row ??= Object.create(null);
        return row[this.key];
    }
    async createSetter(value) { // setters in AsyncChilds must first get the value to modify it
        let row = await this.parent.get()
        row ??= Object.create(null);
        row[this.key] = value;
        // structuredClone is needed to make the row a new object.
        // TODO: we need to deep compare the old and new row to avoid unnecessary updates
        return this.parent.set( structuredClone(row) );
    }
    async remove(){
        const row = await this.parent.get();
        if (row) {
            delete row[this.key];
            await this.parent.set( structuredClone(row) );
        }
        super.remove();
    }
}
AsyncItem.ChildClass = AsyncChild;



// resolveAll is a helper function to resolve all *touched* items in an item-object
export async function resolveAll(item) {
    const value = await item.get();
    if (typeof value === 'object' && value != null) {
        const results = await Promise.all([...item].map(resolveAll));
        for (const sub of item) {
            value[sub.key] = results.shift();
        }
    }
    return value;
}

// export async function loadAll(item) {
//     await item?.loadItems();
//     await Promise.allSettled([...item].map(loadAll));
// }