import { Item } from '../../../item.js';
import { Table } from './Table.js';

export class Db extends Item {

    query(){ throw new Error('Not implemented'); }

    async row(sql){
        for (const row of await this.query(sql)) return row;
    }

    async one(sql){
        const row = await this.row(sql);
        return Object.values(row)[0];
    }

    quote(value){
        return "'" + (value + '').replace(/'/g, "''") + "'";
    }

    quoteId(name){
        return `"${String(name).replace(/"/g, '""')}"`;
    }

    async reader(){
        const tables = await this.query("SHOW TABLES");
        for (const table of tables) this.item(Object.values(table)[0]);
    }

    static isPrimitive() { return false; }
    static ChildClass = Table;
}
