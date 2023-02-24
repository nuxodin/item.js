import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/mysql@v2.8.0/mod.ts";

export class MysqlDb extends Db {
    constructor(){
        super();
    }
    async connect(options){
        const client = new Client();
        this.connection = await client.connect(options);
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
