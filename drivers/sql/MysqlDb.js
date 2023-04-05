import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/mysql@v2.11.0/mod.ts";

export class MysqlDb extends Db {
    constructor(){
        super();
    }
    async connect(options){

        this.name = options.db;
        delete options.db;

        const client = new Client();
        this.connection = await client.connect(options);

        await this.connection.execute("CREATE DATABASE IF NOT EXISTS `"+this.name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); // Encryption = 'Y'?
        await this.connection.execute(`USE \`${this.name}\``);
    }
    close(){
        this.connection.close();
    }
    query(sql, params){
        try {
            return this.connection.query(sql, params);
        } catch(e) {
            console.log(sql, e) //throw e;
            return false;
        }
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
    }
}
