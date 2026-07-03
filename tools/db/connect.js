// Bind a dialect descriptor + an injected runner into a small query handle.
// The runner ({ query, exec, transaction }) is connection-aware but dialect-dumb;
// tools/db never imports a database client. Everything speaks only sql`` fragments.
import { render, resolveSql } from './sql.js';

/** @param dialect descriptor  @param runner { query(text,params), exec(text,params), transaction(fn) } */
export function connect(dialect, runner) {
    const query = async (frag) => {
        await resolveSql(frag);
        const { text, params } = render(frag, dialect);
        return runner.query(text, params);
    };
    const exec = async (frag, { returning } = {}) => {
        if (returning && dialect.appendReturning) frag = dialect.appendReturning(frag, returning);
        await resolveSql(frag);
        const { text, params } = render(frag, dialect);
        return runner.exec(text, params);
    };
    return {
        dialect,
        query,
        exec,
        row: (frag) => query(frag).then((rows) => rows[0]),
        columns: (table) => dialect.columns(runner.query, table),
        transaction: (fn) => runner.transaction(fn),
    };
}
