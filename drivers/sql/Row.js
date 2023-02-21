import { Item } from '../../item.js';
import { Cell } from './Cell.js';

export class Row extends Item {
    constructor(table, eid){
        super(table, eid);
        this.table  = this.parent;
        this.db     = this.parent.parent;
    }
    // async cells() { // todo: just loop fields and make unfilled cells
    //     if (!this.hasAllCells) { // todo, evaluate if has all
    //         const where = await this.table.rowIdToWhere(this.key);
    //         const data = await this.db.row("SELECT * FROM "+this.table+" WHERE "+where);
    //         this._is = !!data;
    //         for (const name in data) {
    //             const cell = this.item(name);
    //             if (cell.P_value === undefined) cell.P_value = Promise.resolve(data[name]);
    //         }
    //         this.hasAllCells = true;
    //     }
    //     return this._cells;
    // }
    async values() {
        const obj = {};
        const cells = await this.cells();
        for (const name in cells) { // todo: Promise.all()
            obj[name] = await cells[name].value;
        }
        return obj;
    }
    /*
    async set(values){
        let cells = await this.cells();
        for (let name in cells) { // todo: Promise.all()
            if (values[name] !== undefined) {
                cells[name].value = values[name];
            }
        }
    }
    */
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
        await this.db.query("UPDATE "+this.table+" SET "+sets+" WHERE "+where+" ");
        const cells = await this.cells();
        for (const name in cells) {
            if (values[name] === undefined) continue;
            cells[name]._value = values[name];
        }
    }
    async is() {
        // todo: request its primaries if not yet?
        // if (this._is === undefined) await this.cells();
        // return this._is ? this : false;
    }
    async makeIfNot() {
        const is = await this.is();
        if (!is) {
            const values = await this.table.rowIdObject(this.key);
            return await this.table.insert(values);
        }
    }
    toString() { return this.key; }
    valueOf() { return this.key; }

    static ChildClass = Cell;
}
