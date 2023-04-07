import { AsyncItem } from "../../../tools/AsyncItem.js";

export class Cell extends AsyncItem {
    constructor(row, name) {
        super(row, name);
        this.row = this.parent;
        this.table = this.parent.parent;
        this.db = this.table.parent;
        this.field = this.table.field(name);
    }
    async createGetter() {
        return (await this.row.selectForce([this.key]))[this.key];
    }
    async createSetter(value) {
        return await this.row.updateForce({[this.key]:value});
    }
    remove() {
        throw new Error("Cannot remove a single cell");
    }
    toString() { return this.key; }
    valueOf() { return this.key; }
}