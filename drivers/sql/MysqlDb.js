import { Item } from '../../item.js';
import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/mysql@v2.11.0/mod.ts";

class MysqlDb extends Db {
    async connect(){
        const client = new Client();
        this.connection = await client.connect(this.parent.options);
        await this.connection.execute("CREATE DATABASE IF NOT EXISTS `"+this.key+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); // Encryption = 'Y'?
        await this.connection.execute(`USE \`${this.key}\``);
    }
    close(){
        this.connection.close();
    }
    async query(sql, params){
        try {
            return await this.connection.query(sql, params);
        } catch(e) {
            console.log(sql, e) //throw e;
            return false;
        }
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
    }
    remove(){
        this.query("DROP DATABASE `"+this.key+"`");
        super.remove();
    }
}

export class Mysql extends Item {
    constructor(options){
        super();
        this.options = options;
    }
    async connect(){
        const client = new Client();
        return await client.connect(this.options);
    }
    async loadItems(){
        const connection = await this.connect();
        const rows = await connection.query("SHOW DATABASES");
        for (const row of rows) {
            console.log(row.Database)
            this.item(row.Database);
        }
        connection.close();
    }
    ChildClass = MysqlDb;
}
