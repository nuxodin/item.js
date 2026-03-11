import { Item } from '../../item.js';
import { Db } from './Items/Db.js';
import { Table } from './Items/Table.js';
import { Field } from './Items/Field.js';
import { Row } from './Items/Row.js';
import { DB } from 'https://deno.land/x/sqlite@v3.9.1/mod.ts';
import { fromFileUrl, resolve } from 'https://deno.land/std/path/mod.ts';

const quoteId = (name) => `"${String(name).replace(/"/g, '""')}"`;

function coerceDefault(value, schema) {
    if (value == null || /^current_(time|date|timestamp)$/i.test(value)) return undefined;
    let parsed = String(value);
    if (/^'.*'$/.test(parsed)) parsed = parsed.slice(1, -1).replace(/''/g, "'");
    if (schema.type === 'boolean') return parsed === '1' || parsed.toLowerCase() === 'true';
    if (schema.type === 'integer') {
        const nr = Number.parseInt(parsed, 10);
        return Number.isNaN(nr) ? parsed : nr;
    }
    if (schema.type === 'number') {
        const nr = Number(parsed);
        return Number.isNaN(nr) ? parsed : nr;
    }
    return parsed;
}

function schemaFromInfo(info) {
    const type = String(info.type || '').toLowerCase();
    const integerPrimary = !!info.pk && /^integer(?:\b|\s|\()/.test(type || 'integer');
    const schema = {
        title: info.name,
        'x-dbType': info.type || '',
        'x-primary': !!info.pk,
        'x-autoIncrement': integerPrimary,
        required: !integerPrimary && !!info.notnull && info.dflt_value == null,
    };
    if (/^(bool|boolean)$/.test(type)) schema.type = 'boolean';
    else if (/^(int|integer|tinyint|smallint|mediumint|bigint)/.test(type)) schema.type = 'integer';
    else if (/^(real|double|float|numeric|decimal)/.test(type)) schema.type = 'number';
    else if (/^(datetime|timestamp)/.test(type)) Object.assign(schema, { type: 'string', format: 'date-time' });
    else if (/^date/.test(type)) Object.assign(schema, { type: 'string', format: 'date' });
    else if (/^json/.test(type)) schema.type = 'object';
    else schema.type = 'string';
    const def = coerceDefault(info.dflt_value, schema);
    if (def !== undefined) schema.default = def;
    return schema;
}

class SqliteField extends Field {
    async getSchema() {
        if (this.schema) return this.schema;
        await this.table.fields();
        return this.schema;
    }
}

class SqliteTable extends Table {
    field(name) {
        if (!this._fields[name]) this._fields[name] = new SqliteField(this, name);
        return this._fields[name];
    }
    async fields() {
        if (!this.a_fields) {
            const all = await this.parent.query(`PRAGMA table_info(${quoteId(this.key)})`);
            this.a_fields = [];
            this.a_primaries = [];
            for (const info of all) {
                const field = this.field(info.name);
                field.info = info;
                field.schema = schemaFromInfo(info);
                this.a_fields.push(field);
                if (info.pk) this.a_primaries.push({ order: info.pk, field });
                if (field.schema['x-autoIncrement']) this._autoincrement = field;
            }
            this.a_primaries.sort((a, b) => a.order - b.order);
            this.a_primaries = this.a_primaries.map(entry => entry.field);
        }
        return this.a_fields;
    }
    async remove() {
        await this.parent.query(`DROP TABLE ${quoteId(this.key)}`);
        super.remove();
    }
    async insert(data) {
        const fields = await this.fields();
        const names = [];
        const values = [];
        for (const field of fields) {
            if (data[field.name] === undefined) continue;
            names.push(quoteId(field.name));
            values.push(await field.valueToSql(data[field.name]));
        }
        const sql = names.length
            ? `INSERT INTO ${quoteId(this.key)} (${names.join(', ')}) VALUES (${values.join(', ')})`
            : `INSERT INTO ${quoteId(this.key)} DEFAULT VALUES`;
        const done = await this.parent.query(sql);
        if (!done.affectedRows) return false;
        const auto = await this.autoincrement();
        if (auto) data[auto.name] = done.lastInsertId;
        return this.item(await this.rowId(data));
    }

    static ChildClass = Row;
}

export class Sqlite extends Db {
    constructor(options = {}) {
        super();
        this.options = typeof options === 'string' ? { file: options } : options;
    }
    async connect() {
        if (this.connection) return this.connection;
        const file = this.options.file ?? ':memory:';
        this.file = file.startsWith?.('file:') ? fromFileUrl(file) : file === ':memory:' ? file : resolve(file);
        this.connection = new DB(this.file);
        return this.connection;
    }
    async close() {
        if (!this.connection) return;
        this.connection.close();
        this.connection = null;
    }
    async query(sql, params = []) {
        await this.connect();
        try {
            const type = sql.trimStart().split(/\s+/, 1)[0]?.toUpperCase();
            if (type === 'SELECT' || type === 'PRAGMA') return this.connection.queryEntries(sql, params);
            this.connection.query(sql, params);
            return {
                affectedRows: this.connection.changes,
                lastInsertId: this.connection.lastInsertRowId,
            };
        } catch (e) {
            console.error(sql);
            throw e;
        }
    }
    async reader() {
        const tables = await this.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        for (const table of tables) this.item(table.name);
    }
    quote(value) {
        return "'" + (value + '').replace(/'/g, "''") + "'";
    }
    setSchema(schema) {
        Item.prototype.setSchema.call(this, schema);
    }

    static ChildClass = SqliteTable;
}