import { Item } from "../item.js";

/*
AsyncChild is useful when you have a data source that only supports object replace
but not partial updates.
This item will then read the full parent object, update the child value and write the full object back.

Note: io regions do the write-through by themselves now (`owner.readsFull = true` + plain
Items as children). What remains here is the auto-read — the core throws on an unloaded
region instead. See doc/PLAN-io-regions.md: this class may be dropped entirely.
*/

export class AsyncChild extends Item {
    // reader delivers (via ioRoot) this child's whole subtree — licences partial writes once loaded
    readsFull = true;

    constructor(parent, key) {
        super(parent, key);
        this.ioRoot = parent instanceof AsyncChild ? parent.ioRoot : parent;
    }

    async reader() {
        await this.ioRoot.read();
    }

    async writer(value) { // the source only supports full replace, so write the whole root region
        // `loaded`, not `filled`: navigating to a child already fills the tree, only io knows
        // whether the root's data ever actually arrived — writing an unread region would erase it.
        if (this.ioRoot.reader && !this.ioRoot.loaded) {
            await this.ioRoot.read();
            this.set(value, { local: true }); // the read overwrote the fresh local change — re-apply
        }
        return this.ioRoot.io.set(this.ioRoot.peek());
    }

    async remover() {
        await this.parent.read();
        const data = this.parent.peek();
        if (data) {
            delete data[this.key];
            await this.parent.set(structuredClone(data));
        }
    }
}
