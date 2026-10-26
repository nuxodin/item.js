// shared/sql.js — helpers shared by SQL dialects

export function quoteId(name) {
  return `\`${String(name).replaceAll('`', '``')}\``;
}

export async function queryRows(query, sql) {
  const res = await query(sql);
  return Array.isArray(res) ? res : res.rows ?? [];
}

/** First non-null JSON-Schema type: 'integer' | ['string','null'] → 'string'. */
export function schemaType(prop) {
  return Array.isArray(prop.type) ? prop.type.find(t => t !== 'null') : prop.type;
}

/** Precision and scale of a fixed-point column for a number with multipleOf: the scale from
 *  multipleOf (0.05 → 2), the digits before the point from the bounds — without bounds 10, as MySQL's
 *  own default. Within the dialect's limits. */
export function decimalSize(prop, maxPrecision, maxScale) {
  const scale = Math.min(maxScale, Math.max(0, Math.ceil(-Math.log10(prop.multipleOf) - 1e-9)));
  const bound = Math.max(Math.abs(prop.minimum ?? 0), Math.abs(prop.maximum ?? 0));
  const digits = bound >= 1 ? Math.floor(Math.log10(bound)) + 1 : bound ? 0 : 10;
  return [Math.min(maxPrecision, Math.max(1, digits + scale)), scale];
}

/** What a fixed-point column of that precision and scale reports: its step and its bounds, as integer
 *  columns report theirs — so a wider declaration widens it. */
export function decimalProps(precision, scale, unsigned = false) {
  const max = Number((10 ** (precision - scale) - 10 ** -scale).toFixed(scale));
  return { ...scale > 0 ? { multipleOf: Math.pow(10, -scale) } : {}, maximum: max, minimum: unsigned ? 0 : -max };
}

const numericTypes = new Set(['boolean', 'integer', 'number']);

/** JSON-Schema default → SQL literal: numeric columns get an unquoted number
 *  (boolean false→0, true→1), string columns a quoted literal ('' for a boolean).
 *  Used by mysql/sqlite; dialects with native literals can keep their own renderer. */
export function defaultLiteral(prop) {
  if (numericTypes.has(schemaType(prop))) return Number(prop.default);
  if (typeof prop.default === 'boolean') return "''";
  return `'${String(prop.default).replace(/'/g, "''")}'`;
}
