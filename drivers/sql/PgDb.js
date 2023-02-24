import { Db } from "./Items/Db.js";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export class PgDb extends Db {
    constructor(){
        super();
    }
    async connect(options){
        this.client = new Client(options);
        await client.connect();
    }
    query(sql, params){
        try {
            return this.client.queryObject(sql, params);
        } catch(e) {
            console.log(sql, e) //throw e;
            return false;
        }
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
    }
}
