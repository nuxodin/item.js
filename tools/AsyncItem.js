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
    }
    createGetter() { throw new Error('createGetter not implemented'); }
    createSetter(value) { throw new Error('createSetter not implemented (value: ' + value + ')'); }

    $get() {
        return this.master.get();
    }
    $set(value) {
        return this.master.set(value);
    }
    ChildClass = AsyncChild;
}

// TODO?: new AsyncChild, no need for separate AsyncDataPoints?
// export class AsyncChild extends Item {
//     $get() {
//         return this.parent.value.then(row => {
//             row ??= Object.create(null);
//             return row[this.key];
//         });
//     }
//     $set(value) {
//         return this.parent.value.then( row => {
//             row ??= Object.create(null);
//             row[this.key] = value;
//             // structuredClone is needed to make the row a new object.
//             // TODO: we need to deep compare the old and new row to avoid unnecessary updates
//             return this.parent.value = structuredClone(row);
//         });
//     }
// }

export class AsyncChild extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        this.master.options = this.parent.master.options;
    }
    createGetter() {
        return this.parent.get().then(row => {
            row ??= Object.create(null);
            return row[this.key];
        });
    }
    createSetter(value) {
        return this.parent.get().then( row => {
            row ??= Object.create(null);
            row[this.key] = value;
            // structuredClone is needed to make the row a new object.
            // TODO: we need to deep compare the old and new row to avoid unnecessary updates
            return this.parent.set( structuredClone(row) );
        });
    }
}


// resolveAll is a helper function to resolve all *touched* items in an item-object
export async function resolveAll(item) {
    const value = await item.get();
    if (typeof value === 'object' && value != null) {
        const results = await Promise.all([...item].map(item=>item.get()));

        for (const sub of item) {
            value[sub.key] = results.shift();
        }
        // await Promise.all(promises).then(results => {
        //     console.log(results)
        //     for (let i = 0; i < promises.length; i++) {
        //         const key = promises[i].key;
        //         value[key] = results[i];
        //     }
        // });
    }
    return value;
}