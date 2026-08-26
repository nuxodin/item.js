export type SqlPart = { text: string } | { param: unknown } | { id: unknown };

export class Sql {
    parts: SqlPart[];
    constructor(parts?: SqlPart[]);
}

export interface SqlTag {
    (strings: TemplateStringsArray, ...values: unknown[]): Sql;
    id(name: string | { toString(): string } | Promise<string | { toString(): string }>): Sql;
    raw(text: string): Sql;
    join(frags: Sql[], separator?: string): Sql;
    in(col: string | Sql, values: Iterable<unknown>): Sql;
    notIn(col: string | Sql, values: Iterable<unknown>): Sql;
}

export const sql: SqlTag;

export function resolveSql(frag: Sql): Promise<void>;

export function render(
    frag: Sql,
    dialect: { quoteId(name: string): string; placeholder(n: number): string },
): { text: string; params: unknown[] };

export function isTemplate(a: unknown): a is TemplateStringsArray;
