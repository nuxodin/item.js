import { Item } from '../../../item.js';
import { Cell } from './Cell.js';

export class Row extends Item {
    constructor(table, key){
        super(table, key);
        this.table  = this.parent;
        this.db     = this.parent.parent;
    }
    async loadItems() {
        const fields = await this.table.fields();
        for (const field of fields) {
            this.item(field.name);
        }
    }
    async values() {
        await this.loadItems();
        return resolveAll(this);
    }
    async setValues(values){
        const where = await this.table.rowIdToWhere(this.key);
        const sets  = await this.table.objectToSet(values);
        if (!sets) return;
        await this.db.query("UPDATE "+this.table+" SET "+sets+" WHERE "+where+" ");
        await this.loadItems();
        for (const name in this.value) {
            if (values[name] === undefined) continue;
            this.item(name).master.setFromMaster(values[name]);
        }
    }
    remove() {
        this.db.query("DELETE FROM "+this.table+" WHERE "+this.table.rowIdToWhere(this.key));
        super.remove();
    }
    toString() { return this.key; }
    valueOf() { return this.key; }

    static ChildClass = Cell;
}
