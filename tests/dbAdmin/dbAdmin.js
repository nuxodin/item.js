import { Mysql }  from '../../adapter/sql/Mysql.js';
import { Sqlite } from '../../adapter/sql/Sqlite.js';
import { schemaFromDb as mysqlSchemaFromDb }  from '../../tools/schema/db/mysql/from-db.js';
import { schemaFromDb as sqliteSchemaFromDb } from '../../tools/schema/db/sqlite/from-db.js';

export async function createDbAdmin(config = readConfig()) {
    const isSqlite   = config.driver === 'sqlite';
    const db         = isSqlite ? new Sqlite({ file: config.file }) : new Mysql(config).item(config.database);
    const schemaFromDb = isSqlite ? sqliteSchemaFromDb : mysqlSchemaFromDb
    await db.connect()
    db.setSchema(await schemaFromDb(sql => db.query(sql)))
    return db
}

function readConfig() {
    return {
        driver:   (Deno.env.get('DB_DRIVER') ?? 'mysql').toLowerCase(),
        host:     Deno.env.get('DB_HOST') ?? 'localhost',
        port:     Number(Deno.env.get('DB_PORT') ?? 3306),
        username: Deno.env.get('DB_USER') ?? Deno.env.get('DB_USERNAME') ?? 'admin',
        password: Deno.env.get('DB_PASSWORD') ?? '',
        database: Deno.env.get('DB_NAME') ?? 'v9',
        file:     Deno.env.get('DB_FILE') ?? import.meta.dirname + '/assets/test.sqlite',
    };
}