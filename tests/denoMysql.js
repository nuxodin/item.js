import {db} from "../drivers/denoMysql.js";
import {Client} from "https://deno.land/x/mysql/mod.ts";
//import * as schemaSql from "../schema/sql.js";


const connection = await new Client().connect({host: "localhost", db:'v7_test'});
const d = db(connection);


const firstname = d.item('usr').item(3).item('firstname');
console.log(await firstname);

//firstname.value = 'Tobias';