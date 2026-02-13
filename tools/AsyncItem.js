import { Item, dispatchEvent } from "../item.js";
import { AsyncDataPoint } from "./AsyncDataPoint.js";

/*
AsyncItem is an Item that supports asynchronous get/set operations.
Access patterns:
    • item.$get() returns the last known value synchronously (undefined while pending).
    • item.promise returns a Promise for the current value (waits if pending).
    • When the value resolves, a 'change' event is triggered.
    • Use effects or event listeners to react to changes.

Example:
        item.addEventListener('change', ({detail}) => console.log(detail.value));
        item.$get(); // returns undefined while pending, then the resolved value
        await item.promise; // always resolves to the current value
*/
export class AsyncItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.asyncHandler = new AsyncDataPoint({
            get: () => this.createGetter(),
            set: (value, abortSignal) => this.createSetter(value, abortSignal)
        });
        this.asyncHandler.onchange = ({value, oldValue}) => {
            this.$set(value); // make sure the item's value is updated
            // needed, but why? $set should trigger change if needed, but #value is not handled by item base class!
            dispatchEvent(this, 'change', { item: this, value, oldValue });
        }
    }

    createGetter() { throw new Error('createGetter not implemented'); }
    createSetter(value) { throw new Error(`createSetter not implemented (value: ${value})`); }

    get promise() {
        return this.asyncHandler.get();
    }
    $get() {
        this.asyncHandler.get(); // trigger getter
        return this.asyncHandler.recentValue;
    }
    $set(value) {
        return this.asyncHandler.set(value);
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
        this.asyncHandler.options = this.parent.asyncHandler.options; // same options as parent
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