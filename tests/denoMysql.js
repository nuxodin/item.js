import { Mysql } from "../drivers/sql/Mysql.js";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

import "../../reporter.js/mod.js";


Deno.test("databases add/remove", async () => {

    const client = new Mysql({host: 'localhost'});

    const rootConnection = await client.connect();

    await client.item('itemjs_mysql_test').connect();
    await client.item('itemjs_mysql_test_tmp').connect();

    const hasTmp = (await rootConnection.query("SHOW DATABASES")).map(row=>row.Database).includes('itemjs_mysql_test_tmp');
    assertEquals(hasTmp, true);

    await client.item('itemjs_mysql_test').close();
    await client.item('itemjs_mysql_test_tmp').close();

    await client.loadItems();

    const itemsKeys = [...client].map(db=>db.key);
    assertEquals(itemsKeys.includes('itemjs_mysql_test'), true);
    assertEquals(itemsKeys.includes('itemjs_mysql_test_tmp'), true);

    await client.item('itemjs_mysql_test_tmp').remove();

    const hasTmp2 = (await rootConnection.query("SHOW DATABASES")).map(row=>row.Database).includes('itemjs_mysql_test_tmp');
    assertEquals(hasTmp2, false);

    rootConnection.close();

    await new Promise(resolve => setTimeout(resolve, 2200)); // wait for getter cache to expire
});


Deno.test("database query", async () => {
    const client = new Mysql({host: 'localhost'});
    const db = client.item('itemjs_mysql_test');
    await db.connect();

    const tables = await db.query(`SHOW TABLES LIKE 'test'`);
    assertEquals(Array.isArray(tables), true);

    const tables2 = await db.query("SHOW TABLES LIKE "+db.quote('te\'s\'\'t'));
    assertEquals(Array.isArray(tables2), true);

    db.close();
});

Deno.test("database query error", async () => {
    const client = new Mysql({host: 'localhost'});
    const db = client.item('itemjs_mysql_test');
    await db.connect();

    try {
        await db.query("x y z");
        assertEquals(true, false);
    } catch {
        assertEquals(true, true);
    }
    db.close();
});


Deno.test("database table", async () => {

    const client = new Mysql({host: 'localhost'});
    const db = client.item('itemjs_mysql_test');
    await db.connect();

    await db.query(
    `CREATE TABLE IF NOT EXISTS test (
        id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id),
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL
    )`);
    await db.query(`TRUNCATE TABLE test`);

    const table = await db.item('test');

    const row = await table.insert({name: 'Tobias', age: 42});
    assertEquals( row.key, '1' );


    const values = table.item(1).item('name').get();
    const values2 = table.item(1).item('age').get();
    console.log(await Promise.all([values, values2])); // generates only one query
    const data = await table.item(1).select(['name', 'age', 'id']);
    console.log(data);

    console.log('values:', values);

    await row.update({
        name: 'Tobias 2 sss',
        age: 43
    });

    row.item('name').value = 'Tob\'ias';
    row.item('age').value = 43;

    assertEquals(
        await row.item('name').value,
        'Tob\'ias'
    );
    // wait for getter cache to expire
    // todo: await row.item('name').set('Tobias2');
    await new Promise(resolve => setTimeout(resolve, 2200));
    db.close();

    // const name = await db.item('test').item(1).item('name').value;
    // console.log('item.key:', name)



});
