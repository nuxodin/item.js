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
        return "'"+(value+'').replace(/'/g, "\'")+"'";
    }

    async loadItems(){
        const tables = await this.query("SHOW TABLES");
        for (const table of tables) this.item(table.key);
    }


    // schema
    async setSchema(schema){
        this.schema = schema;
        for (const [name, schema] of Object.entries(this.schema.properties)) {
            await this.item(name).setSchema(schema);
        }
    }
    async getSchema(){
        if (this.schema) return this.schema;
        this.schema = {
            type: 'object',
            properties: {}
        };
        const tables = await this.tables();
        for (const table of tables) {
            const schema = await table.getSchema();
            this.schema.properties[table.key] = schema;
        }
    }

    static ChildClass = Table;
}
