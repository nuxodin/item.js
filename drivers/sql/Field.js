
export class Field {
    constructor(table, name) {
        this.name = name;
        this.table = table;
        this.db = table.parent;
    }

    // schema
    showColumns(){
        return this.db.row("SHOW COLUMNS FROM `"+this.table+"` LIKE '"+this.name+"'");
        // {
        //     Field: "xxx_firstname",
        //     Type: "varchar(255)",
        //     Null: "YES",
        //     Key: "",
        //     Default: null,
        //     Extra: ""
        // }
    }
    async setSchema(schema){
        this.schema = schema;
        const {toFieldDefinition} = await import('../../../schema.js/tools/toSql.js');
        const row = await this.showColumns();
        const query = "ALTER TABLE `"+this.table+"` "+(row ? " CHANGE COLUMN `"+this+"` `"+this+"` " : " ADD COLUMN `"+this+"` ")+toFieldDefinition(schema);
        console.log(query)
        this.db.query(query);
    }
    async getSchema(){
        if (this.schema) return this.schema;
        const {fromDBColumn} = await import('../../../schema.js/tools/toSql.js');
        const query = "SHOW COLUMNS FROM `"+this.table+"` LIKE '"+this.name+"'";
        const row = await this.db.row(query);
        this.schema = fromDBColumn(row);
        return this.schema;
    }
    toString(){
        return this.name;
    }
}