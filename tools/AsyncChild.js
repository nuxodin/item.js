import { Item } from "../item.js";

export class AsyncChild extends Item {
    constructor(parent, key) {
        super(parent, key);
    }

    async reader() {
        await this.parent.read(); // parent has to set the full deep object
        // let row = this.parent.get() ?? Object.create(null); // ist parent.get() jemals null? schliesslich wurde ja ein objekt erzwungen...
        // console.log(row)
        // return row[this.key];
    }

    async writer(value) { // setters in AsyncChilds must first get the value to modify it
        await this.parent.read();
        let row = this.parent.get() ?? Object.create(null);
        row[this.key] = value;
        // structuredClone is needed to make the row a new object.
        // we need to deep compare the old and new row to avoid unnecessary updates ??
        return this.parent.set(structuredClone(row));
    }

    async remover() {
        await this.parent.read();
        let row = this.parent.get();
        if (row) {
            delete row[this.key];
            await this.parent.set(structuredClone(row));
        }
    }
}
