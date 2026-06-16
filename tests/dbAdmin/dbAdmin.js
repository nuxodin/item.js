import { Mysql }  from '../../adapter/sql/Mysql.js';
import { PgDb }   from '../../adapter/sql/PgDb.js';
import { Sqlite } from '../../adapter/sql/Sqlite.js';
import { schemaFromDb as mysqlSchemaFromDb }  from '../../tools/schema/db/mysql/from-db.js';
import { schemaFromDb as pgSchemaFromDb }     from '../../tools/schema/db/pg/from-db.js';
import { schemaFromDb as sqliteSchemaFromDb } from '../../tools/schema/db/sqlite/from-db.js';

export async function createDbAdmin(config = readConfig()) {
    const driver = config.driver
    const isPg   = driver === 'pg' || driver === 'postgres' || driver === 'postgresql'
    const db = driver === 'sqlite' ? new Sqlite({ file: config.file })
        : isPg ? new PgDb()
        : new Mysql(config).item(config.database)
    const schemaFromDb = driver === 'sqlite' ? sqliteSchemaFromDb : isPg ? pgSchemaFromDb : mysqlSchemaFromDb
    if (isPg) await db.connect(pgConfig(config))
    else await db.connect()
    db.setSchema(await schemaFromDb(sql => db.query(sql)))
    return db
}

function readConfig() {
    const driver = (Deno.env.get('DB_DRIVER') ?? 'mysql').toLowerCase()
    return {
        driver,
        host:     Deno.env.get('DB_HOST') ?? 'localhost',
        port:     Number(Deno.env.get('DB_PORT') ?? (driver === 'pg' || driver === 'postgres' || driver === 'postgresql' ? 5432 : 3306)),
        username: Deno.env.get('DB_USER') ?? Deno.env.get('DB_USERNAME') ?? 'admin',
        password: Deno.env.get('DB_PASSWORD') ?? '',
        database: Deno.env.get('DB_NAME') ?? 'v9',
        file:     Deno.env.get('DB_FILE') ?? import.meta.dirname + '/assets/test.sqlite',
    };
}

function pgConfig(config) {
    return {
        hostname: config.host,
        port:     config.port,
        user:     config.username,
        password: config.password,
        database: config.database,
    }
}
