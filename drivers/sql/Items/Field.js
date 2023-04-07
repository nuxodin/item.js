
export class Field {
    constructor(table, name) {
        this.name = name;
        this.table = table;
        this.db = table.parent;
    }

	valueTransform(value) {
        const schema = this.getSchema();

        if (typeof value === 'object' && typeof value.valueOf === 'function') value = value.valueOf(); // what about date?

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
	valueToSql(value) {
        value = this.valueTransform(value);
        return value === null ? 'NULL' : this.db.quote(value);
	}


    // schema
    showColumns(){
        return this.db.row("SHOW COLUMNS FROM `"+this.table+"` LIKE '"+this.name+"'");
    }
    async setSchema(schema){
        const {toFieldDefinition} = await import('../../../../jema.js/tools/toSql.js');
        const exists = await this.showColumns();
        let sql = "ALTER TABLE `"+this.table+"` "+(exists ? "CHANGE COLUMN `"+this+"` `"+this+"` " : "ADD COLUMN `"+this+"` ")+toFieldDefinition(schema);
        if (!exists && schema.x_primary) sql += ' PRIMARY KEY';
        this.db.query(sql);
        this.schema = schema;
    }
    async getSchema(){
        if (this.schema) return this.schema;
        const query = "SHOW COLUMNS FROM `"+this.table+"` LIKE '"+this.name+"'";
        const row = await this.db.row(query);
        const {fromShowFields} = await import('../../../../jema.js/tools/toSql.js');
        this.schema = fromShowFields([row])[this.name];
        return this.schema;
    }
    toString(){
        return this.name;
    }
}
