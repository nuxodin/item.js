import { Item } from "../item.js";

/*
AsyncChild is useful when you have a data source that only supports object replace
but not partial updates.
This item will then read the full parent object, update the child value and write the full object back.
*/

export class AsyncChild extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.ioRoot = parent instanceof AsyncChild ? parent.ioRoot : parent;
    }

    async reader() {
        await this.ioRoot.read(); // !filled?
    }

    async writer(value) { // setters in AsyncChilds must first get the value to modify it
        if (!this.ioRoot.filled) await this.ioRoot.read(); // !filled?
        const data = this.parent.peek();
        data[this.key] = value;
        return this.ioRoot.io.set(data);
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
