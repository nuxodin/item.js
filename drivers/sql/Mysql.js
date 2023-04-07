import { Item } from '../../item.js';
import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/mysql@v2.10.0/mod.ts"; // Warning: v2.11.0 has a breaking bug!

class MysqlDb extends Db {
    async connect(){
        if (this.connection) return;
        this.connection = await new Client().connect(this.parent.options);
        await this.connection.execute("CREATE DATABASE IF NOT EXISTS `"+this.key+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); // Encryption = 'Y'?
        await this.connection.execute("USE `"+this.key+"`");
    }
    async close(){
        await this.connection.close();
        this.connection = null;
    }
    async query(sql, params){
        try {
            return await this.connection.query(sql, params);
        } catch(e) {
            console.debug(sql);
            throw e;
        }
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "''")+"'";
    }
    async remove(){
        await this.connect();
        await this.connection.execute("DROP DATABASE `"+this.key+"`");
        this.close();
        super.remove();
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
    async loadItems(){
        const connection = await this.connect();
        const rows = await connection.query("SHOW DATABASES");
        for (const row of rows) this.item(row.Database);
        connection.close();
    }
    ChildClass = MysqlDb;
}
