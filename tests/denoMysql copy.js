import {MysqlDb} from "../drivers/sql/MysqlDb.js";

const d = new MysqlDb();
await d.connect({host: 'localhost', db:'v7_test'});


const firstname = d.item('usr').item(3).item('firstname');
console.log(await firstname);

//firstname.value = 'Tobias';

d.item('usr').setSchema({
    type: 'object',
    properties: {
        xxx_firstname: {
            type: 'string',
            maxLength: 255
        }
    }
});
