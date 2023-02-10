import { Item } from '../../item.js';
import { Table } from './table.js';

export class Db extends Item {
    constructor(connection){
        super();
        this.connection = connection;
    }
    query(sql /*, params */){
        try {
            return this.connection.query(sql /*, params */);
        } catch(e) {
            console.log(sql, e) //throw e;
            return false;
        }
    }
    async row(sql){
        const all = await this.query(sql);
        return all && all[0];
    }
    async one(sql){
        const row = await this.row(sql);
        if (row) for (let i in row) return row[i];
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
        return this.connection.escape(value);
    }

    // schema
    async setSchema(schema){
        this.schema = schema;
        const query = "CREATE DATABASE IF NOT EXISTS `"+this.key+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"; // Encryption = 'Y'?
        await this.parent.query(query);
        for (const {name, schema} of Object.values(this.schema.properties)) {
            this.table(name).setSchema(schema);
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
