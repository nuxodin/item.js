import { Item } from '../../item.js';
import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts"; // Warning: v2.11.0 has a breaking bug!

class MysqlDb extends Db {
    async connect(){
        if (this.connection) return;
        this.connection = await new Client().connect(this.parent.options);
        await this.connection.execute("CREATE DATABASE IF NOT EXISTS "+this.quoteId(this.key)+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); // Encryption = 'Y'?
        await this.connection.execute("USE "+this.quoteId(this.key));
    }
    async close(){
        await this.connection.close();
        this.connection = null;
    }
    async query(sql, params){
        try {
            return await this.connection.query(sql, params); // toto: reconnect if lost
        } catch(e) {
            console.error(sql);
            throw e;
        }
    }
    // quote(value){ return "'"+(value+'').replace(/'/g, "''")+"'"; }
    // quoteId(name){ return `\`${String(name).replace(/`/g, '``')}\``; }
    quote(value)   { return "'" + (value+'').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
    quoteId(name)  { return '`' + String(name).replace(/`/g, '``') + '`'; }

    async remover(){
        await this.connect();
        await this.connection.execute("DROP DATABASE "+this.quoteId(this.key));
        await this.close();
    }
}

export class Mysql extends Item {
    constructor(options){
        super();
        this.options = options;
    }
    async connect(){
        return await new Client().connect(this.options);
    }
    async reader(){
        const connection = await this.connect();
        const rows = await connection.query("SHOW DATABASES");
        for (const row of rows) this.item(row.Database);
        connection.close();
    }
    ChildClass = MysqlDb;
}
