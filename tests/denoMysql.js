import { MysqlDb } from "../drivers/sql/MysqlDb.js";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";


Deno.test("database", async () => {

    const db = new MysqlDb();
    await db.connect({host: 'localhost', db:'v7_test'});

    await db.query(
    `CREATE TABLE IF NOT EXISTS test (
        id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id),
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL
    )`);
    await db.query(`TRUNCATE TABLE test`);

    assertEquals(
        db.item('test').key,
        'test'
    );

    const row = await db.item('test').insert({name: 'Tobias', age: 42});

    assertEquals( row.key, '1' );

    assertEquals(
        await db.item('test').item(1).item('name').value,
        'Tobias'
    );

    row.item('name').value = 'Tobias2';

    assertEquals(
        await row.item('name').value,
        'Tobias2'
    );

    // wait for getter cache to expire
    // todo: await row.item('name').set('Tobias2');
    await new Promise(resolve => setTimeout(resolve, 2200));

    // const name = await db.item('test').item(1).item('name').value;
    // console.log('item.key:', name)



    db.close();
});
