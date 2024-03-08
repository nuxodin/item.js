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
        for (const field of fields) this.item(field.name);
    }



    // select
    // async selectAll() {
    //     await this.loadItems();
    //     return resolveAll(this);
    // }

    select(array) { // select, batched ✅, cached ✅
        const promises = {}
        for (const key of array) promises[key] = this.item(key).get();
        return PromiseAllObject(promises);
    }

    #getBatchValues = {};
    #getBatchPromise = null;

    selectForce(array) { // select, batched ✅, not cached ❌
        for (const key of array) this.#getBatchValues[key] = true;
        if (!this.#getBatchPromise) {
            this.#getBatchPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(this.#select(this.#getBatchValues));
                    this.#getBatchValues = {};
                    this.#getBatchPromise = null;
                });
            });
        }
        return this.#getBatchPromise;
    }

    async #select(values){ // select, not batched ❌, not cached ❌
        const where = await this.table.rowIdToWhere(this.key);
        const data = await this.db.query("SELECT "+Object.keys(values).join(", ")+" FROM "+this.table+" WHERE "+where);
        if (!data.length) throw new Error("Row not found");
        if (data.length > 1) throw new Error("Multiple rows found");
        return data[0];
    }




    // update

    update(values) { // update, batched ✅, if not cached ✅
        const promises = {}
        for (const name in values) {
            promises[name] = this.item(name).set(values[name]);
        }
        return PromiseAllObject(promises);
    }


    #setBatchValues = {};
    #setBatchPromise = null;

    updateForce(values) { // update, batched ✅, ignore cached ❌
        Object.assign(this.#setBatchValues, values);
        if (!this.#setBatchPromise) {
            this.#setBatchPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(this.#update(this.#setBatchValues));
                    this.#setBatchValues = {};
                    this.#setBatchPromise = null;
                });
            });
        }
        return this.#setBatchPromise;
    }

    async #update(values){ // update, not batched ❌, ignore cached ❌
        const where = await this.table.rowIdToWhere(this.key);
        const sets  = await this.table.objectToSet(values);
        if (!sets) return;
        const done = await this.db.query("UPDATE "+this.table+" SET "+sets+" WHERE "+where);
        if (done.affectedRows === 0) throw new Error("Row not found");
        if (done.affectedRows > 1) throw new Error("Multiple rows affected");

        // needed?
        // for (const name in values) {
        //     this.item(name).asyncHandler.setFromMaster(values[name]);
        // }
        return done;
    }


    async remove() {
        await this.db.query("DELETE FROM "+this.table+" WHERE "+this.table.rowIdToWhere(this.key));
        super.remove();
    }
    toString() { return this.key; }
    valueOf() { return this.key; }

    static ChildClass = Cell;
}


// helper

const PromiseAllObject = (obj) => {
    const keys = Object.keys(obj);
    return Promise.all(Object.values(obj)).then(values => {
        const result = {};
        for (const i in keys) result[keys[i]] = values[i];
        return result;
    });
}
