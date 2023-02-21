import { Db } from "./sql/Db.js";


export const db = function(connection){
    return new Db(connection);
}
