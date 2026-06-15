// mysql/to-db.js
import { schemaFromDb } from "./from-db.js";
import { quoteId, toFieldDef } from "./to-field.js";
import { schemaDiff } from "../../diff.js";

function tableData(tableSchema) {
  const row = tableSchema.additionalProperties ?? {};
  const fields = Object.entries(row.properties ?? {});
  const required = new Set(row.required ?? []);
  return { fields, required };
}

function primaryFields(fields) {
  return fields.filter(([, f]) => f["x-index"] === "primary").map(([n]) => n);
}

const columnProps = new Set([
  "type", "format", "contentEncoding", "maxLength", "minLength",
  "minimum", "maximum", "multipleOf", "$comment",
]);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function fieldChanged(diffs, table, field, prop) {
  return diffs.some(d =>
    d.path[0] === "properties" &&
    d.path[1] === table &&
    d.path[2] === "additionalProperties" &&
    d.path[3] === "properties" &&
    d.path[4] === field &&
    (columnProps.has(d.property) || d.property === "default" && hasOwn(prop, "default"))
  );
}

function preserveDefault(prop, currProp) {
  return hasOwn(prop, "default") || !hasOwn(currProp, "default")
    ? prop
    : { ...prop, default: currProp.default };
}

function setEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function secondaryIndexKind(prop) {
  if (prop["x-index"] === "unique") return "UNIQUE KEY";
  if (prop["x-index"] === "fulltext") return "FULLTEXT KEY";
  if (prop["x-index"] === true) return "KEY";
  return null;
}

function usableIndexKind(table, name, prop) {
  const kind = secondaryIndexKind(prop);
  const issue = kind && indexIssue(table, name, prop, kind);
  if (!issue) return kind;
  console.warn(issue);
  return null;
}

function indexIssue(table, name, prop, kind) {
  const schemaType = Array.isArray(prop.type) ? prop.type.find(t => t !== "null") : prop.type;
  if (kind === "FULLTEXT KEY") return schemaType === "string" && !prop.format && !prop.contentEncoding ? "" : `Skip ${kind} ${table}.${name}: fulltext indexes require plain string fields`;
  if (schemaType !== "string" || prop.format || (prop.maxLength ?? Infinity) <= 191) return "";
  const max = prop.maxLength ?? "unknown";
  return `Skip ${kind} ${table}.${name}: string maxLength ${max} is too long for a normal index; use maxLength <= 191, x-index:"fulltext", or remove x-index`;
}

function secondaryIndexDef(table, name, prop) {
  const kind = usableIndexKind(table, name, prop);
  return kind && secondaryIndexSql(name, kind);
}

function secondaryIndexSql(name, kind) {
  return `${kind} ${quoteId(name)} (${quoteId(name)})`;
}

async function tableIndexes(query, table) {
  const rows = await query(`SHOW INDEX FROM ${quoteId(table)}`);
  const primary = rows
    .filter(row => row.Key_name === "PRIMARY")
    .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
    .map(row => row.Column_name);
  const grouped = new Map();
  for (const row of rows) {
    const key = row.Key_name;
    if (key === "PRIMARY") continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const secondary = [...grouped.entries()]
    .filter(([, rows]) => rows.length === 1)
    .map(([key, [row]]) => ({
      key,
      column: row.Column_name,
      nonUnique: row.Non_unique,
      indexType: row.Index_type,
      subPart: row.Sub_part,
    }));
  return { primary, secondary };
}

function autoIncrementField(fields) {
  return fields.find(([, prop]) => prop["x-autoincrement"]);
}

export async function schemaToDb(
  schema,
  query,
  { force = false, patch = false } = {},
) {
  const current = await schemaFromDb(query);
  const diffs = schemaDiff(schema, current);

  if (!patch) {
    const destructive = diffs.filter((d) => d.destructive === true);
    if (destructive.length && !force) {
      const msgs = destructive.map((d) => `  ${d.path.join(".")} — ${d.msg}`).join("\n");
      throw new Error(`Destructive schema changes detected (use force to apply):\n${msgs}`);
    }
  }

  const stmts = [];
  const nextTables = Object.keys(schema.properties ?? {});
  const currTables = Object.keys(current.properties ?? {});

  for (const table of nextTables) {
    const tableId = quoteId(table);
    const { fields, required } = tableData(schema.properties[table]);
    const primaries = primaryFields(fields);
    for (const p of primaries) required.add(p); // primary key columns are always NOT NULL

    if (!currTables.includes(table)) {
      const cols = fields.map(([n, f]) =>
        "  " + toFieldDef(n, f, { required: required.has(n) })
      ).join(",\n");
      const pk = primaries.length
        ? `,\n  PRIMARY KEY (${primaries.map(quoteId).join(", ")})`
        : "";
      const keys = fields
        .filter(([n]) => !primaries.includes(n))
        .map(([n, f]) => secondaryIndexDef(table, n, f))
        .filter(Boolean)
        .map((def) => ",\n  " + def)
        .join("");
      stmts.push(
        `CREATE TABLE ${tableId} (\n${cols}${pk}${keys}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      );
    } else {
      const { fields: currFieldEntries, required: currRequired } = tableData(
        current.properties[table],
      );
      const currFields = Object.keys(Object.fromEntries(currFieldEntries));
      const indexStmts = await indexStatements(
        query,
        table,
        fields,
        currFieldEntries,
        { patch },
      );
      stmts.push(...indexStmts.before);
      const autoAfter = new Map();
      for (const [name, prop] of fields) {
        const isRequired = required.has(name);
        const curr = currFieldEntries.find(([n]) => n === name);
        const propWithDefault = curr ? preserveDefault(prop, curr[1]) : prop;
        const fieldProp = propWithDefault["x-autoincrement"] ? { ...propWithDefault, "x-autoincrement": false } : propWithDefault;
        const fieldDef = toFieldDef(name, fieldProp, { required: isRequired });
        if (!currFields.includes(name)) {
          stmts.push(`ALTER TABLE ${tableId} ADD COLUMN ${fieldDef};`);
          if (prop["x-autoincrement"]) autoAfter.set(name, prop);
        } else {
          const hasAuto = !!curr?.[1]["x-autoincrement"];
          const wantsAuto = !!prop["x-autoincrement"];
          const wantsChange = fieldChanged(diffs, table, name, prop) ||
            isRequired !== currRequired.has(name) ||
            hasAuto && !wantsAuto;
          const changed = wantsChange && fieldDef !== toFieldDef(name, curr[1], { required: currRequired.has(name) });
          if (changed) {
            stmts.push(`ALTER TABLE ${tableId} MODIFY COLUMN ${fieldDef};`);
          }
          if (wantsAuto && (changed || !hasAuto)) autoAfter.set(name, propWithDefault);
        }
      }
      if (!patch) {
        for (const name of currFields) {
          if (!fields.find(([n]) => n === name)) {
            stmts.push(`ALTER TABLE ${tableId} DROP COLUMN ${quoteId(name)};`);
          }
        }
      }
      stmts.push(...indexStmts.after);
      if (indexStmts.primaryChanged) {
        const nextAuto = autoIncrementField(fields);
        if (nextAuto) autoAfter.set(nextAuto[0], nextAuto[1]);
      }
      for (const [name, prop] of autoAfter) {
        stmts.push(`ALTER TABLE ${tableId} MODIFY COLUMN ${toFieldDef(name, prop, { required: true })};`);
      }
    }
  }

  if (!patch) {
    for (const table of currTables) {
      if (!nextTables.includes(table)) stmts.push(`DROP TABLE ${quoteId(table)};`);
    }
  }

  for (const stmt of stmts) {
    console.log(stmt);
    await query(stmt);
  }
  return { diffs, executed: stmts };
}

async function indexStatements(query, table, nextFields, currFields, { patch = false } = {}) {
  const before = [];
  const after = [];
  const tableId = quoteId(table);
  const indexes = await tableIndexes(query, table);
  const currPrimary = new Set(indexes.primary.length ? indexes.primary : primaryFields(currFields));
  const nextPrimary = new Set(primaryFields(nextFields));
  const currentSecondary = indexes.secondary;

  const primaryChanged = !setEqual(currPrimary, nextPrimary) && (!patch || nextPrimary.size);
  if (primaryChanged) {
    const currAuto = autoIncrementField(currFields);
    if (currAuto) {
      const [name, prop] = currAuto;
      before.push(`ALTER TABLE ${tableId} MODIFY COLUMN ${toFieldDef(name, { ...prop, "x-autoincrement": false }, { required: true })};`);
    }
    if (currPrimary.size) before.push(`ALTER TABLE ${tableId} DROP PRIMARY KEY;`);
    if (nextPrimary.size) {
      const cols = [...nextPrimary].map(quoteId).join(", ");
      after.push(`ALTER TABLE ${tableId} ADD PRIMARY KEY (${cols});`);
    }
  }

  for (const [name, prop] of nextFields) {
    if (nextPrimary.has(name)) continue;
    const nextKind = usableIndexKind(table, name, prop);
    const current = currentSecondary.find(i => i.column === name);
    const currentKind = current
      ? current.indexType === "FULLTEXT"
        ? "FULLTEXT KEY"
        : current.nonUnique
        ? "KEY"
        : "UNIQUE KEY"
      : null;
    const changed       = current && (currentKind !== nextKind || current.subPart != null);
    if (patch && !nextKind) continue;
    if (changed) {
      const indexId = quoteId(current.key);
      before.push(`ALTER TABLE ${tableId} DROP INDEX ${indexId};`);
    }
    if (nextKind && (!current || changed)) {
      after.push(`ALTER TABLE ${tableId} ADD ${secondaryIndexSql(name, nextKind)};`);
    }
  }

  if (!patch) {
    for (const current of currentSecondary) {
      const stillWanted = nextFields.find(([name, prop]) => name === current.column && usableIndexKind(table, name, prop));
      if (!stillWanted) {
        const indexId = quoteId(current.key);
        before.push(`ALTER TABLE ${tableId} DROP INDEX ${indexId};`);
      }
    }
  }

  return { before, after, primaryChanged };
}
