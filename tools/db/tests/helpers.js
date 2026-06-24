import { DatabaseSync } from 'node:sqlite';
import { connect } from '../connect.js';
import { sqlite } from '../dialect/sqlite.js';
import { schemaToDb } from '../../schema/db/sqlite/to-db.js';

// A host-provided runner — connection-aware, dialect-dumb. tools/db ships none.
export function sqliteRunner(db, onQuery) {
    return {
        query: (text, params = []) => { onQuery?.(text); return Promise.resolve(db.prepare(text).all(...params)); },
        exec: (text, params = []) => {
            const r = db.prepare(text).run(...params);
            return Promise.resolve({ insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) });
        },
        transaction: async (fn) => {
            db.exec('BEGIN');
            try { const v = await fn(); db.exec('COMMIT'); return v; }
            catch (e) { db.exec('ROLLBACK'); throw e; }
        },
    };
}

const oneTable = (name, props) => ({ properties: { [name]: { additionalProperties: { properties: props } } } });

/** Fresh in-memory SQLite with one table, wrapped in a connect() handle. */
export async function tableCon(name, props, onQuery) {
    const db = new DatabaseSync(':memory:');
    await schemaToDb(oneTable(name, props), (s) => Promise.resolve(db.prepare(s).all()), { patch: true });
    return connect(sqlite, sqliteRunner(db, onQuery));
}

export const mailCon = (props, onQuery) => tableCon('mail', props, onQuery);
