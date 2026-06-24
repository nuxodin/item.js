export type SqlPart = { text: string } | { param: unknown } | { id: string };

export class Sql {
    parts: SqlPart[];
    constructor(parts?: SqlPart[]);
}

export interface SqlTag {
    (strings: TemplateStringsArray, ...values: unknown[]): Sql;
    id(name: string): Sql;
    raw(text: string): Sql;
    join(frags: Sql[], separator?: string): Sql;
}

export const sql: SqlTag;

export function render(
    frag: Sql,
    dialect: { quoteId(name: string): string; placeholder(n: number): string },
): { text: string; params: unknown[] };
