import { AsyncItem } from "../../tools/AsyncItem.js";

export class Cell extends AsyncItem {
    constructor(row, name) {
        super(row, name);
        this.row = this.parent;
        this.table = this.parent.parent;
        this.db = this.table.parent;
    }
    async createGetter() {
        const where = await this.table.rowIdToWhere(this.row.key);
        return await this.db.one("SELECT "+this.key+" FROM "+this.table+" WHERE "+where+" ");
    }
    createSetter(value) {
        return this.row.set({[this.key]:value});
    }
    toString() { return this.key; }
    valueOf() { return this.key; }
}



// class Cell extends Item {
//     constructor(row, name) {
//         super(row, name);
//         this.row = this.parent;
//         this.table = this.parent.parent;
//         this.db = this.table.parent;
//     }
//     get value() {
//         return this.getValue();
//     }
//     set value(value) {
//         this.setValue(value);
//         // const promi = this.P_value = this.table.rowIdToWhere(this.row.key).then(where=>{
//         //     return this.db.query("UPDATE "+this.table+" SET "+this.key+" = "+this.db.quote(value)+" WHERE "+where+" ");
//         // });
//         // this.P_value = Promise.resolve(value);
//         // promi;
//     }
//     async getValue() {
//         if (this._value === undefined) {
//             const where = await this.table.rowIdToWhere(this.row.key);
//             this._value = await this.db.one("SELECT "+this.key+" FROM "+this.table+" WHERE "+where+" ");
//         }
//         return this._value;
//     }
//     async setValue(value){
//         //this._value = value; // for now it has to refetch value
//         this._value = undefined;
//         await this.row.set({[this.key]:value});
//     }
//     toString() { return this.key; }
//     valueOf() { return this.key; }
// }
