import { Item } from '../../../item.js';
import { Row } from './Row.js';
import { Field } from './Field.js';

export const Table = class extends Item {
    constructor(db, name){
        super(db, name);
        this._fields = {};
    }
    async loadItems() {
        const rows = await this.parent.query("SELECT * FROM "+this.key); // todo, just get primaries?
        for (const data of rows) {
            const id = await this.rowId(data);
            const row = this.item(id);
            for (const field in data) {
                row.item(field).asyncHandler.setLocal(data[field]);
            }
        }
    }
    async remove() {
        await this.parent.query("DROP TABLE " + this);
        super.remove();
    }


    // async ensure(filter) {
    //     console.error('used?')
    //     const rows = await this.rows(filter);
    //     for (const row of rows) return row; // return first
    //     return this.insert(filter); // else insert, todo: filter?
    // }
    // async rows(filter /* limit? */) {
    //     console.error('used?')
    //     const where = await this.objectToWhere(filter); // todo
    //     const all = await this.parent.query("SELECT * FROM "+this.key+" WHERE " + where);
    //     const rows = [];
    //     for (const data of all) {
    //         const id = await this.rowId(data);
    //         const row = this.item(id);
    //         for (const i in data) {
    //             console.log('asyncHandler?');
    //             row.cell(i).setLocal(data[i]); // todo: asyncHandler??
    //         }
    //         rows.push( row );
    //     }
    //     return rows;
    // }


    field(name) {
        //console.debug('used?')
        if (!this._fields[name]) this._fields[name] = new Field(this, name);
        return this._fields[name];
    }
    async fields(){
        //console.debug('used?')
        if (!this.a_fields) {
            const all = await this.parent.query("SHOW FIELDS FROM " + this.key); // just "this"?
            this.a_fields = [];
            this.a_primaries = [];
            all.forEach(values=>{
                const name = values['Field'];
                const field = new Field(this, name);
                this._fields[name] = field;
                this.a_fields.push(field);
                if (values['Key'] === 'PRI') this.a_primaries.push(field);
                if (values['Extra'] === 'auto_increment') this._autoincrement = field;
            });
        }
        return this.a_fields;
    }

    async primaries(){
        //console.debug('used?')
        await this.fields();
        return this.a_primaries;
    }
    async autoincrement(){
        //console.debug('used?')
        await this.fields();
        return this._autoincrement;
    }
    async rowId(array){
        //console.debug('used?')
        if ({string:1,number:1}[typeof array]) return array;
        return (await this.primaries()).map(field=>{
            //if (field instanceof Row) { ... }
            if (array[field.name] === undefined) throw new Error('entryId: property "'+this+'.'+field.name+'" not present');
            return array[field.name];
        }).join('-:-');
    }
    async rowIdObject(id){
        //console.debug('used?')
        const isObject = !{string:1,number:1}[typeof id];
        const object = Object.create(null);
        const primaries = await this.primaries();
        if (isObject) { // make a new object, or better return id direct?
            for (const field of primaries) {
                if (id[field.name] === undefined) throw new Error('rowIdObject: property "'+this+'.'+field.name+'" not present');
                object[field.name] = id[field.name];
            }
        } else {
            const values = (id+'').split('-:-');
            for (const field of primaries) {
                const value = values.shift();
                if (value === undefined) throw new Error('rowIdObject: property "'+this+'.'+field.name+'" not present');
                object[field.name] = value;
            }
        }
        return object;
    }
    async rowIdToWhere(id){
        //console.debug('used?')
        const obj = await this.rowIdObject(id);
        return await this.objectToWhere(obj);
    }

    async _objectToSqls(object, alias=null, isSet=false) {
        //console.debug('used?')
        if (object == undefined) throw new Error('objectToSqls: object is undefined');
        const sqls = [];
        const fields = await this.fields();
        for (const field of fields) {
            if (object[field.name] === undefined) continue;
            const sqlValue = field.valueToSql(object[field.name]);
            const sqlField = (alias?alias+'.':'') + field.name;
			const equal = (!isSet && sqlValue==='NULL'?' IS ':' = ');
			sqls.push(sqlField + equal + sqlValue);
        }
        return sqls;
    }
	async objectToWhere(data, alias=null) {
        //console.debug('used?')
        const sqls = await this._objectToSqls(data, alias);
        return sqls.join(' AND ');
	}
	async objectToSet(data, alias=null) {
        //console.debug('used?')
        const sqls = await this._objectToSqls(data, alias, true);
        return sqls.join(' , ');
	}

    async insert(data) {
        //console.debug('used?')
        const set = await this.objectToSet(data);
        const done = await this.parent.query("INSERT INTO " + this + (set ? " SET "+set : " () values () "));
        if (!done.affectedRows) return false;
        const auto = await this.autoincrement();
        if (auto) data[auto.name] = done.lastInsertId;
        const rowId = await this.rowId(data);
        const item = this.item(rowId);
        return item;
    }

    toString() { return this.key; }
    valueOf() { return this.key; }

    // schema
    async setSchema(schema){

        // const {fromShowFields} = await import('../../../../jema.js/tools/toSql.js');
        // const fields = await this.parent.query("SHOW FULL FIELDS FROM " + this.key);
        // const existingSchema = fromShowFields(fields);

        this.schema = schema;
        const query = "CREATE TABLE IF NOT EXISTS `"+this+"` ( _qgtmp varchar(0) NOT NULL ) ENGINE = MYISAM";
        await this.parent.query(query);
        for (const [name, schema] of Object.entries(this.schema.properties)) {
            this.field(name).setSchema(schema);
        }
        // todo primaries / indexes
    }
    /*
    async setPrimaries(newPrimaries){
        const existing = await this.primaries();
        let changed = false;
        for (const newPrimary of newPrimaries) {
            const field = this._fields[newPrimary];
            if (!field) throw new Error('field '+this+'.'+newPrimary+' does not exist');
            if (!existing.includes(field)) changed = true;
        }
        if (changed) {
            try {
                await this.parent.query("ALTER TABLE "+this+" DROP PRIMARY KEY");
            } catch {}
            await this.parent.query("ALTER TABLE "+this+" ADD PRIMARY KEY ("+newPrimaries.join(',')+")");
            this.a_field = null; // remove cache
        }
    }
    */


    static isPrimitive() { return false; }
    static ChildClass = Row;
};
