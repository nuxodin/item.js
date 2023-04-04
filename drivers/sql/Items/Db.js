import { Item } from '../../../item.js';
import { Table } from './Table.js';

export class Db extends Item {
    constructor(){
        super();
    }
    query(){ throw new Error('Not implemented'); }
    async row(sql){
        for (const row of await this.query(sql)) return row;
    }
    async one(sql){
        return Object.values(await this.row(sql))[0];
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
    }

    async loadItems(){
        const tables = await this.query("SHOW TABLES");
        for (const table of tables) {
            this.item(table.key);
        }
    }


    // schema
    async setSchema(schema){
        this.schema = schema;
        //const query = "CREATE DATABASE IF NOT EXISTS `"+this.name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"; // Encryption = 'Y'?
        const query = "CREATE DATABASE IF NOT EXISTS `"+this.name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"; // Encryption = 'Y'?
        await this.query(query);

        for (const [name, schema] of Object.entries(this.schema.properties)) {
            this.item(name).setSchema(schema);
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
