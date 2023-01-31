import {Item} from '../item.js';
import {AsyncItem} from '../tools/AsyncItem.js';

export const db = function(connection){
    return new DB(connection);
}


class Cell extends AsyncItem {
    constructor(row, name) {
        super(row, name);
        this.row = this.parent;
        this.table = this.parent.parent;
        this.db = this.table.parent;
    }
    async createGetter() {
        const where = await this.table.rowIdToWhere(this.row.key);
        return await this.db.one("SELECT "+this.key+" FROM "+this.table+" WHERE "+where+" ");
    }
    createSetter(value) {
        return this.row.set({[this.key]:value});
    }
    toString() { return this.key; }
    valueOf() { return this.key; }
}

// class Cell extends Item {
//     constructor(row, name) {
//         super(row, name);
//         this.row = this.parent;
//         this.table = this.parent.parent;
//         this.db = this.table.parent;
//     }
//     get value() {
//         return this.getValue();
//     }
//     set value(value) {
//         this.setValue(value);
//         // const promi = this.P_value = this.table.rowIdToWhere(this.row.key).then(where=>{
//         //     return this.db.query("UPDATE "+this.table+" SET "+this.key+" = "+this.db.quote(value)+" WHERE "+where+" ");
//         // });
//         // this.P_value = Promise.resolve(value);
//         // promi;
//     }
//     async getValue() {
//         if (this._value === undefined) {
//             const where = await this.table.rowIdToWhere(this.row.key);
//             this._value = await this.db.one("SELECT "+this.key+" FROM "+this.table+" WHERE "+where+" ");
//         }
//         return this._value;
//     }
//     async setValue(value){
//         //this._value = value; // for now it has to refetch value
//         this._value = undefined;
//         await this.row.set({[this.key]:value});
//     }
//     toString() { return this.key; }
//     valueOf() { return this.key; }
// }


class Row extends Item {
    constructor(table, eid){
        super(table, eid);
        this.table  = this.parent;
        this.db     = this.parent.parent;
    }
    // async cells() { // todo: just loop fields and make unfilled cells
    //     if (!this.hasAllCells) { // todo, evaluate if has all
    //         const where = await this.table.rowIdToWhere(this.key);
    //         const data = await this.db.row("SELECT * FROM "+this.table+" WHERE "+where);
    //         this._is = !!data;
    //         for (const name in data) {
    //             const cell = this.item(name);
    //             if (cell.P_value === undefined) cell.P_value = Promise.resolve(data[name]);
    //         }
    //         this.hasAllCells = true;
    //     }
    //     return this._cells;
    // }
    async values() {
        const obj = {};
        const cells = await this.cells();
        for (const name in cells) { // todo: Promise.all()
            obj[name] = await cells[name].value;
        }
        return obj;
    }
    /*
    async set(values){
        let cells = await this.cells();
        for (let name in cells) { // todo: Promise.all()
            if (values[name] !== undefined) {
                cells[name].value = values[name];
            }
        }
    }
    */
    async set(values){
        //if (this.valueToSet === undefined) this.valueToSet = {};
        // todo clean values here
        //mixin(values, this.valueToSet, true); // time to set other values until this.valueToSet = {};
        const where = await this.table.rowIdToWhere(this.key);
        // todo trigger

        //const sets  = await this.table.objectToSet(this.valueToSet);
        const sets  = await this.table.objectToSet(values);

        if (!sets) return;
        //this.valueToSet = {};
        await this.db.query("UPDATE "+this.table+" SET "+sets+" WHERE "+where+" ");
        const cells = await this.cells();
        for (const name in cells) {
            if (values[name] === undefined) continue;
            cells[name]._value = values[name];
        }
    }
    async is() {
        // todo: request its primaries if not yet?
        // if (this._is === undefined) await this.cells();
        // return this._is ? this : false;
    }
    async makeIfNot() {
        const is = await this.is();
        if (!is) {
            const values = await this.table.rowIdObject(this.key);
            return await this.table.insert(values);
        }
    }
    toString() { return this.key; }
    valueOf() { return this.key; }

    static ChildClass = Cell;
}




const Table = class extends Item {
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

    static ChildClass = Row;
};


class Field {
    constructor(table, name) {
        this.name = name;
        this.table = table;
    }
    // async isPrimary(){
    //     const primaries = await this.table.primaries();
    //     return primaries.includes(this);
    // }
}






class DB extends Item {
    constructor(connection){
        super();
        this.connection = connection;
    }
    query(sql /*, params */){
        try {
            return this.connection.query(sql /*, params */);
        } catch(e) {
            console.log(sql, e) //throw e;
            return false;
        }
    }
    async row(sql){
        const all = await this.query(sql);
        return all && all[0];
    }
    async one(sql){
        const row = await this.row(sql);
        if (row) for (let i in row) return row[i];
    }
    quote(value){
        return "'"+(value+'').replace(/'/g, "\'")+"'";
        return this.connection.escape(value);
    }

    static ChildClass = Table;
}
