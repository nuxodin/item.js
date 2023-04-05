import { Item } from '../../../item.js';
import { Cell } from './Cell.js';

export class Row extends Item {
    constructor(table, key){
        super(table, key);
        this.table  = this.parent;
        this.db     = this.parent.parent;
    }
    async values() {
        await this.loadItems();
        return resolveAll(this);
        const obj = {};
        const cells = await this.cells();
        for (const name in cells) { // todo: Promise.all()
            obj[name] = await cells[name].value;
        }
        return obj;
    }
    async loadItems() {
        const fields = await this.table.fields();
        for (const field of fields) {
            this.item(field.name);
        }
    }



    async set(values){
        //if (this.valueToSet === undefined) this.valueToSet = {};
        // todo clean values here
        //mixin(values, this.valueToSet, true); // time to set other values until this.valueToSet = {};
        const where = await this.table.rowIdToWhere(this.key);
        // todo trigger

        //const sets  = await this.table.objectToSet(this.valueToSet);
        const sets  = await this.table.objectToSet(values);

        if (!sets) return;
        //this.valueToSet = {};
console.log("UPDATE "+this.table+" SET "+sets+" WHERE "+where+" ");
        await this.db.query("UPDATE "+this.table+" SET "+sets+" WHERE "+where+" ");
        await this.loadItems();
        for (const name in this.value) {
            if (values[name] === undefined) continue;
            this.item(name).master.setFromMaster(values[name]);
        }
    }
    // async is() {
    //     const where = await this.table.rowIdToWhere(this.key);
    //     // todo: request its primaries if not yet?
    //     // if (this._is === undefined) await this.cells();
    //     // return this._is ? this : false;
    // }
    // async makeIfNot() {
    //     const is = await this.is();
    //     if (!is) {
    //         const values = await this.table.rowIdObject(this.key);
    //         return await this.table.insert(values);
    //     }
    // }
    toString() { return this.key; }
    valueOf() { return this.key; }

    static ChildClass = Cell;
}
