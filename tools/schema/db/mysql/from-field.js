// mysql/schema-from-field.js
// Note: MySQL VARCHAR/CHAR lengths are in characters; TEXT sizes are byte caps.

const intRanges = {
  tinyint: { signed: [-128, 127], unsigned: [0, 255] },
  smallint: { signed: [-32768, 32767], unsigned: [0, 65535] },
  mediumint: { signed: [-8388608, 8388607], unsigned: [0, 16777215] },
  int: { signed: [], unsigned: [0, 4294967295] },
  integer: { signed: [], unsigned: [0, 4294967295] },
  bigint: {
    signed: [-9007199254740991, 9007199254740991],
    unsigned: [0, 9007199254740991],
  }, // JS safe
};
const textBytes = {
  tinytext: 255,
  text: 65535,
  mediumtext: 16777215,
  longtext: 4294967295,
};
const B = 4; // bytes per char, worst-case utf8mb4

export function schemaFromField(row) {
  const prop = {};
  const unsigned = /unsigned/i.test(row.Type);
  const isAuto = /auto_increment/i.test(row.Extra ?? "");
  const [rawType, rawLen] = row.Type.replace(/\s*unsigned/i, "").split(/[()]/);
  const type = rawType.trim().toLowerCase();
  const len = rawLen ? parseInt(rawLen) : null;

  if (type === "tinyint" && len === 1) {
    prop.type = "boolean";
  } else if (type in intRanges) {
    const [min, max] = intRanges[type][unsigned ? "unsigned" : "signed"];
    prop.type = "integer";
    if (min != null && max != null && !(isAuto && (type === "int" || type === "integer"))) {
      prop.minimum = min;
      prop.maximum = max;
    }
  } else if (type === "float" || type === "double" || type === "real") {
    prop.type = "number";
  } else if (type === "decimal" || type === "numeric") {
    prop.type = "number";
    const scale = rawLen ? parseInt(rawLen.split(",")[1] ?? 0) : 0;
    if (scale > 0) prop.multipleOf = Math.pow(10, -scale);
  } else if (type === "char") {
    prop.type = "string";
    prop.minLength = len;
    prop.maxLength = len;
  } else if (type === "varchar") {
    prop.type = "string";
    prop.maxLength = len;
  } else if (type in textBytes) {
    prop.type = "string";
    if (type !== "text") prop.maxLength = Math.floor(textBytes[type] / B);
  } else if (type === "binary") {
    prop.type = "string";
    prop.contentEncoding = "base64";
    prop.minLength = len;
    prop.maxLength = len;
  } else if (type === "varbinary") {
    prop.type = "string";
    prop.contentEncoding = "base64";
    prop.maxLength = len;
  } else if (/blob/.test(type)) {
    prop.type = "string";
    prop.contentEncoding = "base64";
  } else if (type === "date") {
    prop.type = "string";
    prop.format = "date";
  } else if (type === "time") {
    prop.type = "string";
    prop.format = "time";
  } else if (type === "datetime" || type === "timestamp") {
    prop.type = "string";
    prop.format = "date-time";
  } else if (type === "year") {
    prop.type = "integer";
    prop.minimum = 1901;
    prop.maximum = 2155;
  } else if (type === "json") prop.type = "object";
  else if (type === "enum") {
    prop.type = "string";
    prop.enum = rawLen.split(",").map((s) => s.replace(/'/g, ""));
  } else if (type === "set") {
    prop.type = "array";
    prop.items = {
      type: "string",
      enum: rawLen.split(",").map((s) => s.replace(/'/g, "")),
    };
  } else prop.type = "string";

  if (row.Default != null) prop.default = row.Default;
  if (row.Comment) prop["$comment"] = row.Comment;
  if (row.Key === "PRI") prop["x-index"] = "primary";
  if (row.Key === "UNI") prop["x-index"] = "unique";
  if (row.Key === "MUL") prop["x-index"] = true;
  if (isAuto) prop["x-autoincrement"] = true;

  return prop;
}
