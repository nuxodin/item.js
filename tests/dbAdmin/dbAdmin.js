import { Mysql } from '../../adapter/sql/Mysql.js';
import { Sqlite } from '../../adapter/sql/Sqlite.js';

export async function createDbAdmin(config = readConfig()) {
    if (config.driver === 'sqlite') return await createSqliteDbAdmin(config);
    return await createMysqlDbAdmin(config);
}

async function createMysqlDbAdmin(config) {
    const mysql = new Mysql({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
    });
    const db = mysql.item(config.database);
    await db.connect();
    const schema = await schemaFromDb(db);
    mysql.setSchema({
        type: 'object',
        properties: {
            [config.database]: schema,
        },
    });
    return db;
}

async function createSqliteDbAdmin(config) {
    const db = new Sqlite({ file: config.file });
    await db.connect();
    db.setSchema(await schemaFromSqliteDb(db));
    return db;
}

async function schemaFromDb(db) {
    const properties = Object.create(null);
    await db.read();
    for (const tableName of db.keys) {
        const fields = await db.query(`SHOW FULL FIELDS FROM ${quoteId(tableName)}`);
        properties[tableName] = tableSchemaFromFields(tableName, fields);
    }
    return { type: 'object', properties };
}

async function schemaFromSqliteDb(db) {
    const properties = Object.create(null);
    await db.read();
    for (const tableName of db.keys) {
        const table = db.item(tableName);
        const fields = await table.fields();
        const rowSchema = { type: 'object', properties: Object.create(null) };
        const primaryKeys = [];
        const required = [];
        for (const field of fields) {
            const schema = await field.getSchema();
            rowSchema.properties[field.name] = schema;
            if (schema['x-primary']) primaryKeys.push(field.name);
            if (schema.required) required.push(field.name);
        }
        if (required.length) rowSchema.required = required;
        properties[tableName] = {
            type: 'object',
            title: tableName,
            additionalProperties: rowSchema,
            'x-primaryKeys': primaryKeys,
        };
    }
    return { type: 'object', properties };
}

function tableSchemaFromFields(tableName, fields) {
    const rowSchema = { type: 'object', properties: Object.create(null) };
    const primaryKeys = [];
    const required = [];
    for (const field of fields) {
        const name = field.Field;
        const schema = fieldSchemaFromDbField(field);
        rowSchema.properties[name] = schema;
        if (schema['x-primary']) primaryKeys.push(name);
        if (!schema['x-autoIncrement'] && field.Null === 'NO' && field.Default == null) required.push(name);
    }
    if (required.length) rowSchema.required = required;
    return {
        type: 'object',
        title: tableName,
        additionalProperties: rowSchema,
        'x-primaryKeys': primaryKeys,
    };
}

function fieldSchemaFromDbField(field) {
    const type = String(field.Type).toLowerCase();
    const schema = {
        title: field.Comment || field.Field,
        'x-dbType': field.Type,
        'x-primary': field.Key === 'PRI',
        'x-autoIncrement': String(field.Extra).includes('auto_increment'),
    };
    if (type.startsWith('tinyint(1)')) schema.type = 'boolean';
    else if (/^(int|bigint|smallint|tinyint|mediumint)/.test(type)) schema.type = 'integer';
    else if (/^(decimal|float|double)/.test(type)) schema.type = 'number';
    else if (/^(datetime|timestamp)/.test(type)) Object.assign(schema, { type: 'string', format: 'date-time' });
    else if (/^date/.test(type)) Object.assign(schema, { type: 'string', format: 'date' });
    else if (/^json/.test(type)) schema.type = 'object';
    else schema.type = 'string';
    if (type.startsWith('enum(')) schema.enum = [...type.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'"));
    if (field.Default != null && field.Default !== 'CURRENT_TIMESTAMP') schema.default = coerceValue(field.Default, schema);
    return schema;
}

function coerceValue(value, schema) {
    if (value === '' || value == null) return value === '' && schema.type === 'string' ? '' : null;
    if (schema.type === 'boolean') return value === true || value === 1 || value === '1' || value === 'true';
    if (schema.type === 'integer') return Number.parseInt(value, 10);
    if (schema.type === 'number') return Number(value);
    return value;
}

function quoteId(name) {
    return `\`${String(name).replace(/`/g, '``')}\``;
}

function readConfig() {
    return {
        driver: (Deno.env.get('DB_DRIVER') ?? 'mysql').toLowerCase(),
        host: Deno.env.get('DB_HOST') ?? 'localhost',
        port: Number(Deno.env.get('DB_PORT') ?? 3306),
        username: Deno.env.get('DB_USER') ?? Deno.env.get('DB_USERNAME') ?? 'admin',
        password: Deno.env.get('DB_PASSWORD') ?? 'hollabolla',
        database: Deno.env.get('DB_NAME') ?? 'v9',
        file: Deno.env.get('DB_FILE') ?? './tests/dbAdmin/dbAdmin.sqlite',
    };
}