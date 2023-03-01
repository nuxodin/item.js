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
    // item = AsyncChild
    // overwrite asyncItems can not have items? hmm... but what if the result is a object?
    // then it should be possible to get items from it but get and set should be handled by the AsyncItem
    // should we invent a class "AsyncChild"?
}


// TODO:
export class AsyncChild extends Item {
    constructor(parent, key) {
        super(parent, key);

        // find the asyncRoot
        let asyncItem = null;
        currenParent = parent;
        while (currenParent) {
            if (currenParent instanceof AsyncItem) {
                asyncItem = currenParent;
                break;
            }
            currenParent = currenParent.parent;
        }
        this.asyncRoot = asyncItem;
        if(!asyncItem) throw new Error('AsyncChild can only be used in a AsyncItem');

        // listen to changes
        this.addEventListener('change', () => {

            // TODO:
            // get the value of the asyncRoot
            // walk the path from the async-root (not the real root) to the child (this)
            // set the value
            // save the asyncRoot

            if (asyncItem) asyncItem.master.set(asyncItem.value);
        });
    }
    $get() {
        return this.asyncRoot.value.then(value => {
            // walk the path from the async-root (not the real root) to the child (this)
            const path = this.path.slice(this.asyncRoot.path.length);
            let current = value;
            for (const key of path) {
                current = current[key];
            }
            return current;
        });
    }
}