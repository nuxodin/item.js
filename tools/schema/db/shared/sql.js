// shared/sql.js — helpers shared by the SQL dialects (mysql, sqlite)

export function quoteId(name) {
  return `\`${String(name).replaceAll('`', '``')}\``;
}

/** First non-null JSON-Schema type: 'integer' | ['string','null'] → 'string'. */
export function schemaType(prop) {
  return Array.isArray(prop.type) ? prop.type.find(t => t !== 'null') : prop.type;
}

const numericTypes = new Set(['boolean', 'integer', 'number']);

/** JSON-Schema default → SQL literal: numeric columns get an unquoted number
 *  (boolean false→0, true→1), string columns a quoted literal ('' for a boolean).
 *  Must stay identical across dialects — see db/tests/default-coercion.test.js. */
export function defaultLiteral(prop) {
  if (numericTypes.has(schemaType(prop))) return Number(prop.default);
  if (typeof prop.default === 'boolean') return "''";
  return `'${String(prop.default).replace(/'/g, "''")}'`;
}
