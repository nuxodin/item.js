import { Db } from "./sql/db.js";


export const db = function(connection){
    return new Db(connection);
}
