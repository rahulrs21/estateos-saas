import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/*
 * One-time repair of a LOCAL database that received the unfinished Phase 6E
 * draft schema (2026-10-31). The draft created automation tables and enum types
 * and put its activity and audit values first in two shared enums. SQL Connect
 * cannot reorder or remove enum values, so the final schema (which appends its
 * values, as the hosted rollout requires) fails to migrate on such a database
 * and every query then fails.
 *
 * Run by dev:local while the database is closed, after the startup snapshot.
 * It changes nothing unless draft objects exist, and refuses (changing nothing)
 * if any draft table holds rows or any row uses a draft enum value. Otherwise,
 * in one transaction, it drops the empty draft tables and types and rebuilds
 * the two shared enums without the draft values; SQL Connect then creates the
 * final tables and appends the final values. No other data changes.
 */
const DRAFT_TABLES = ["automation_approval", "automation_event", "automation_execution", "automation_execution_step", "automation_task",
  "automation_worker_state", "automation_workflow", "automation_workflow_version", "scheduled_automation_job"];
const DRAFT_TYPES = ["automation_approval_status", "automation_event_status", "automation_execution_status", "automation_job_status",
  "automation_step_status", "automation_task_status", "automation_workflow_status"];
const SHARED_ENUMS = {
  activity_kind: {schemaEnum: "ActivityKind", draft: ["AUTOMATION_WORKFLOW_CHANGED", "AUTOMATION_EXECUTION_CHANGED", "AUTOMATION_APPROVAL_CHANGED", "AUTOMATION_TASK_CHANGED"]},
  audit_target_type: {schemaEnum: "AuditTargetType", draft: ["AUTOMATION_WORKFLOW", "AUTOMATION_EXECUTION", "AUTOMATION_APPROVAL", "AUTOMATION_TASK"]},
};
// The draft is recognised only by objects the final schema never creates (the final schema reuses the
// other draft value names, appended at the end).
const DRAFT_MARKER_TABLES = ["automation_task", "automation_worker_state"];
const DRAFT_MARKER_VALUES = { activity_kind: "AUTOMATION_TASK_CHANGED", audit_target_type: "AUTOMATION_TASK" };

const ident = value => { if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unexpected identifier ${value}`); return `"${value}"`; };
const literal = value => { if (!/^[A-Z0-9_]+$/.test(value)) throw new Error(`Unexpected enum value ${value}`); return `'${value}'`; };

/** @returns {Promise<"clean" | "repaired">} */
export async function repairAutomationDraft({ cliRoot, dataDir, schemaPath }) {
  const pglite = parts => import(pathToFileURL(join(cliRoot, "node_modules", "@electric-sql", "pglite", ...parts)).href);
  const { PGlite } = await pglite(["dist", "index.js"]);
  const { vector } = await pglite(["dist", "vector", "index.js"]);
  const { uuid_ossp: uuidOssp } = await pglite(["dist", "contrib", "uuid_ossp.js"]);
  const schema = readFileSync(schemaPath, "utf8");
  const schemaValues = name => schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))[1].split(/\s+/).filter(Boolean);

  const db = new PGlite({ dataDir, extensions: { vector, uuidOssp } });
  try {
    const tableNames = async names => (await db.query(`select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)`, [names])).rows.map(row => row.table_name);
    const enumLabels = async type => (await db.query(`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = $1 order by e.enumsortorder`, [type])).rows.map(row => row.enumlabel);
    const markerValues = await Promise.all(Object.entries(DRAFT_MARKER_VALUES).map(async ([type, value]) => (await enumLabels(type)).includes(value)));
    if (!(await tableNames(DRAFT_MARKER_TABLES)).length && !markerValues.some(Boolean)) return "clean";

    const tables = await tableNames(DRAFT_TABLES);
    for (const table of tables) {
      const { n } = (await db.query(`select count(*)::int as n from ${ident(table)}`)).rows[0];
      if (n !== 0) throw new Error(`the draft table ${table} has ${n} rows`);
    }
    const rebuilds = [];
    for (const [type, { schemaEnum, draft }] of Object.entries(SHARED_ENUMS)) {
      const labels = await enumLabels(type);
      const target = labels.filter(label => !draft.includes(label));
      if (target.length === labels.length) continue;
      const wanted = schemaValues(schemaEnum);
      if (target.some((label, index) => wanted[index] !== label)) throw new Error(`${type} without the draft values does not match the start of ${schemaEnum}`);
      const columns = (await db.query(`select c.relname as table, a.attname as column, pg_get_expr(d.adbin, d.adrelid) as def from pg_attribute a
        join pg_class c on c.oid = a.attrelid join pg_type t on t.oid = a.atttypid left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where t.typname = $1 and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped`, [type])).rows;
      const other = (await db.query(`select count(*)::int as n from pg_depend d join pg_type t on t.oid = d.refobjid where t.typname = any($1) and d.classid <> 'pg_class'::regclass and d.classid <> 'pg_type'::regclass`, [[type, `_${type}`]])).rows[0].n;
      if (other) throw new Error(`${type} is used by objects other than table columns`);
      for (const { table, column } of columns) {
        const { n } = (await db.query(`select count(*)::int as n from ${ident(table)} where ${ident(column)}::text = any($1)`, [draft])).rows[0];
        if (n !== 0) throw new Error(`${n} rows of ${table}.${column} use a draft value`);
      }
      rebuilds.push({ type, target, columns });
    }
    const types = (await db.query(`select typname from pg_type where typname = any($1)`, [DRAFT_TYPES])).rows.map(row => row.typname);

    await db.transaction(async tx => {
      if (tables.length) await tx.exec(`drop table ${tables.map(ident).join(", ")}`);
      for (const type of types) await tx.exec(`drop type ${ident(type)}`);
      for (const { type, target, columns } of rebuilds) {
        const previous = `${type}_draft`;
        await tx.exec(`alter type ${ident(type)} rename to ${ident(previous)}`);
        await tx.exec(`create type ${ident(type)} as enum (${target.map(literal).join(", ")})`);
        for (const { table, column, def } of columns) {
          if (def) await tx.exec(`alter table ${ident(table)} alter column ${ident(column)} drop default`);
          await tx.exec(`alter table ${ident(table)} alter column ${ident(column)} type ${ident(type)} using ${ident(column)}::text::${ident(type)}`);
          if (def) await tx.exec(`alter table ${ident(table)} alter column ${ident(column)} set default ${def.replaceAll(previous, type)}`);
        }
        await tx.exec(`drop type ${ident(previous)}`);
      }
    });
    return "repaired";
  } finally {
    await db.close();
  }
}
