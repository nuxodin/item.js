// mysql/to-field.js — JSON Schema property → MySQL column definition

const B = 4; // bytes per char, worst-case utf8mb4

const formats = { date: "DATE", time: "TIME", "date-time": "DATETIME" };

export function quoteId(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

export function toFieldDef(name, prop, { required = false } = {}) {
  let type, unsigned = false;
  const types      = Array.isArray(prop.type) ? prop.type : [prop.type];
  const schemaType = types.find(t => t !== "null");
  const nullable = !required || types.includes("null");

  if (schemaType === "boolean") type = "TINYINT(1)";
  else if (schemaType === "integer") ({ type, unsigned } = integerType(prop));
  else if (schemaType === "number") type = prop.multipleOf ? "DECIMAL" : "DOUBLE";
  else if (schemaType === "object" || schemaType === "array") type = "JSON";
  else type = stringType(prop);

  let sql = `${quoteId(name)} ${type}`;
  if (unsigned) sql += " UNSIGNED";
  sql += !nullable || prop["x-autoincrement"] ? " NOT NULL" : " NULL";
  if (prop.default != null) {
    sql += ` DEFAULT '${String(prop.default).replace(/'/g, "''")}'`;
  }
  if (prop["x-autoincrement"]) sql += " AUTO_INCREMENT";
  if (prop["$comment"]) {
    sql += ` COMMENT '${prop["$comment"].replace(/'/g, "''")}'`;
  }

  return sql;
}

function integerType(prop) {
  if (prop.minimum == null && prop.maximum == null) return { type: "INT", unsigned: !!prop["x-autoincrement"] };
  const min = prop.minimum ?? -Infinity, max = prop.maximum ?? Infinity;
  const unsigned = min >= 0;
  if (unsigned) {
    if (max <= 255) return { type: "TINYINT", unsigned };
    if (max <= 65535) return { type: "SMALLINT", unsigned };
    if (max <= 16777215) return { type: "MEDIUMINT", unsigned };
    if (max <= 4294967295) return { type: "INT", unsigned };
    return { type: "BIGINT", unsigned };
  }
  if (min >= -128 && max <= 127) return { type: "TINYINT", unsigned };
  if (min >= -32768 && max <= 32767) return { type: "SMALLINT", unsigned };
  if (min >= -8388608 && max <= 8388607) return { type: "MEDIUMINT", unsigned };
  if (min >= -2147483648 && max <= 2147483647) return { type: "INT", unsigned };
  return { type: "BIGINT", unsigned };
}

function stringType(prop) {
  if (prop.format in formats) return formats[prop.format];
  if (prop.contentEncoding === "base64") return prop.maxLength ? `VARBINARY(${prop.maxLength})` : "BLOB";
  const maxLength = prop.maxLength ?? Math.floor(65535 / B), maxBytes = maxLength * B;
  if (maxLength <= 255) return `VARCHAR(${maxLength})`;
  if (maxBytes <= 65535) return "TEXT";
  if (maxBytes <= 16777215) return "MEDIUMTEXT";
  return "LONGTEXT";
}
