import { Item } from "../../../item.js";

export class Cell extends Item {
    constructor(row, name) {
        super(row, name);
        this.row = this.parent;
        this.table = this.row.table;
        this.db = this.table.db;
        this.field = this.table.field(name);
    }
    async reader() {
        return (await this.row.selectForce([this.key]))[this.key];
    }
    async writer(value) {
        return await this.row.updateForce({[this.key]:value});
    }
    remove() { throw new Error("Cannot remove a single cell"); }
    add() { throw new Error("DB-Cells have no sub-items"); }
}
