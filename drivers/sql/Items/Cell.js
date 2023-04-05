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
        const where = await this.table.rowIdToWhere(this.row.key);
        return await this.db.one("SELECT "+this.key+" FROM "+this.table+" WHERE "+where+" ");
    }
    createSetter(value) {
        return this.row.set({[this.key]:value});
    }
    remove() {
        throw new Error("Cannot remove a single cell");
    }
    toString() { return this.key; }
    valueOf() { return this.key; }
}