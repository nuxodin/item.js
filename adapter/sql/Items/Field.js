
export class Field {
    constructor(table, name) {
        this.name = name;
        this.table = table;
        this.db = table.db;
    }

	async valueTransform(value) {
        const schema = await this.getSchema();

        // todo: user this.table.schema.additionalProperties.properties[this.name]
        //if (typeof value === 'object' && typeof value.valueOf === 'function') value = value.valueOf(); // what about date?
        //if (typeof value === 'object' && typeof value[Symbol.toPrimitive] === 'function') value = value[Symbol.toPrimitive]('string');

        if (!schema.required) {
            if (value == null) return null;
            if (schema.type!=='string' && value === '') return null;
        }

        if (schema.type === 'boolean') return value ? 1 : 0;

        if (schema.type==='number' || schema.type==='integer') {
            if (typeof value !== 'number') return parseFloat(value);
        }
        if (schema.format === 'date-time' || schema.format === 'date') {
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'number') return new Date(value).toISOString();
        }
        return value;
	}
	async valueToSql(value) {
        value = await this.valueTransform(value);
        return value === null ? 'NULL' : this.db.quote(value);
	}


    // schema
    showColumns(){
        return this.db.row("SHOW COLUMNS FROM "+this.db.quoteId(this.table.key)+" LIKE "+this.db.quote(this.name));
    }
    async setSchema(schema){
        const {toFieldDefinition} = await import('../../../../jema.js/tools/toSql.js');
        const exists = await this.showColumns();
        let sql = "ALTER TABLE "+this.db.quoteId(this.table.key)+" "+(exists ? "CHANGE COLUMN "+this.db.quoteId(this.name)+" "+this.db.quoteId(this.name)+" " : "ADD COLUMN "+this.db.quoteId(this.name)+" ")+toFieldDefinition(schema);
        if (!exists && schema.x_primary) sql += ' PRIMARY KEY';
        this.db.query(sql);
        this.schema = schema;
    }
    async getSchema(){
        if (this.schema) return this.schema;
        const query = "SHOW COLUMNS FROM "+this.db.quoteId(this.table.key)+" LIKE "+this.db.quote(this.name);
        const row = await this.db.row(query);
        const {fromShowFields} = await import('../../../../jema.js/tools/toSql.js');
        const parsed = fromShowFields([row]);
        const schema = parsed.properties[this.name];
        this.schema = schema && {...schema, required: parsed.required?.includes(this.name)};
        return this.schema;
    }
    toString(){
        return this.name;
    }
}
