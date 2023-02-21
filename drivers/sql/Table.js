import { Item } from '../../item.js';
import { Row } from './Row.js';
import { Field } from './Field.js';

export const Table = class extends Item {
    constructor(db, name){
        super(db, name);
        this._fields = {};
    }
    async ensure(filter) {
        const rows = await this.rows(filter);
        for (const row of rows) return row; // return first
        return this.insert(filter); // else insert, todo: filter?
    }
    async rows(filter /* limit? */) {
        const where = await this.objectToWhere(filter); // todo
        const all = await this.parent.query("SELECT * FROM "+this.key+" WHERE " + where);
        const rows = [];
        for (const data of all) {
            const id = await this.rowId(data);
            const row = this.row(id);
            for (const i in data) {
                row.cell(i)._value = data[i]; // todo
                row.cell(i).setFromMaster(data[i]); // todo
            }
            rows.push( row );
        }
        return rows;
    }
    field(name) {
        if (!this._fields[name]) this._fields[name] = new Field(this, name);
        return this._fields[name];
    }
    async fields(){
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
        await this.fields();
        return this.a_primaries;
    }
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
    async autoincrement(){
        await this.fields();
        return this._autoincrement;
    }
    async rowId(array){
        if ({string:1,number:1}[typeof array]) return array;
        return (await this.primaries()).map(field=>{
            //if (field instanceof Row) { ... }
            if (array[field.name] === undefined) throw new Error('entryId: property "'+this+'.'+field.name+'" not present');
            return array[field.name];
        }).join('-:-');
    }
    async rowIdObject(id){
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
        const obj = await this.rowIdObject(id);
        return await this.objectToWhere(obj);
    }
    async _objectToSqls(object, alias=null, isSet=false) {

        if (object == undefined) throw new Error('objectToSqls: object is undefined');

        const sqls = [];
        const fields = await this.fields();
        for (const field of fields) {
            if (object[field.name] === undefined) continue;
            //let sqlValue = field.valueToSql(object[field.name]);
            const sqlValue = this.parent.quote(object[field.name]);
            const sqlField = (alias?alias+'.':'') + field.name;
			const equal = ' = ';
			//let equal = (!isSet && sqlValue==='NULL'?' IS ':' = ');
			sqls.push(sqlField + equal + sqlValue);
        }
        return sqls;
    }
	async objectToWhere(data, alias=null) {
        const sqls = await this._objectToSqls(data, alias);
        return sqls.join(' AND ');
	}
	async objectToSet(data, alias=null) {
        const sqls = await this._objectToSqls(data, alias, true);
        return sqls.join(' , ');
	}
    async insert(data){
        // todo intervention
        // event = {
        //     _waitingPromises:[],
        //     data
        // };
        // event.waitUntil = function(promise){
        //     this._waitingPromises.push(promise);
        // }
        // this.trigger('insert-before',event)
        // async Promise.all(event._waitingPromises);

        const set = await this.objectToSet(data);
        const Statement = await this.parent.query("INSERT INTO " + this + (set ? " SET "+set : " () values () "));
        if (!Statement.affectedRows) return false;
        const auto = await this.autoincrement();
        if (auto) data[auto.name] = Statement.lastInsertId;
        const rowId = await this.rowId(data);
        //this.trigger('insert-after',data);
        return this.row(rowId);
        //return id;
    }
    toString() { return this.key; }
    valueOf() { return this.key; }

    // schema
    async setSchema(schema){
        this.schema = schema;
        const query = "CREATE TABLE IF NOT EXISTS `"+this+"` ( _qgtmp varchar(0) NOT NULL ) ENGINE = MYISAM";
        await this.parent.query(query);
        for (const [name, schema] of Object.entries(this.schema.properties)) {
            this.field(name).setSchema(schema);
        }
        // todo primaries / indexes
    }


    static ChildClass = Row;
};
