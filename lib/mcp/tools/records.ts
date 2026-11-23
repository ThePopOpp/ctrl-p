import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { PostgrestError } from "@supabase/supabase-js";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { cleanRow, column, describeTable, getTable, loadSchema, redact, refreshSchema, type Table } from "../schema";

// Full CRUD over every public table, driven by the live schema (schema.ts).
// This is what the admin dashboard and the public site read and write:
// products, product cards, content (blog, pages, emails), orders, pipeline,
// bookings, digital cards, production, customers and the rest.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "contains"] as const;

const tableArg = z.string().min(1).max(80).describe("Table name from tables_list, e.g. products, content_items, orders");
const keyArg = z.record(z.string(), scalar).optional().describe("Primary key values, e.g. {\"id\": \"…\"} or {\"user_id\": \"…\", \"tag_id\": \"…\"}");
const idArg = z.string().max(200).optional().describe("Shortcut for tables whose primary key is id");
const columnsArg = z.array(z.string().max(80)).max(80).optional().describe("Columns to return (default: all)");
const filtersArg = z
  .array(z.object({
    column: z.string().max(80),
    op: z.enum(OPS).default("eq"),
    value: z.union([scalar, z.array(scalar)]).describe("For in: an array. For is: null, true or false. For like/ilike: use % as wildcard. For contains: an array or object"),
  }))
  .max(20)
  .optional()
  .describe("All must match, e.g. [{\"column\":\"status\",\"op\":\"eq\",\"value\":\"paid\"}]");

type Filter = { column: string; op: (typeof OPS)[number]; value: unknown };
type Row = Record<string, unknown>;

function check(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === "23505") throw new ToolError(`That already exists (${error.details || error.message}).`);
  if (error.code === "23503") throw new ToolError(`A referenced record doesn't exist, or other records still point to this one (${error.details || error.message}).`);
  if (error.code === "23502") throw new ToolError(`A required value is missing: ${error.message}`);
  if (["22P02", "23514", "22007", "22008", "42703", "PGRST204", "P0001", "22023"].includes(error.code)) throw new ToolError(error.message);
  throw new Error(`${error.code}: ${error.message}`);
}

function selectList(t: Table, cols?: string[]) {
  if (!cols?.length) return "*";
  for (const c of cols) column(t, c);
  return cols.join(",");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(t: Table, q: any, filters: Filter[] = []) {
  for (const f of filters) {
    column(t, f.column);
    const v = f.value;
    switch (f.op) {
      case "in":
        if (!Array.isArray(v)) throw new ToolError(`Filter "in" on ${f.column} needs an array.`);
        q = q.in(f.column, v);
        break;
      case "is":
        if (v !== null && v !== true && v !== false) throw new ToolError(`Filter "is" on ${f.column} takes null, true or false.`);
        q = q.is(f.column, v);
        break;
      case "contains":
        q = q.contains(f.column, v);
        break;
      default:
        if (Array.isArray(v)) throw new ToolError(`Filter "${f.op}" on ${f.column} takes one value.`);
        q = q[f.op](f.column, v);
    }
  }
  return q;
}

// Turns id/key into filters that match exactly one row by primary key.
function keyFilters(t: Table, id?: string, key?: Row): Filter[] {
  const k: Row = key && Object.keys(key).length ? key : id != null ? { [t.pk.length === 1 ? t.pk[0] : "id"]: id } : {};
  if (!t.pk.length) throw new ToolError(`${t.name} has no primary key. Use filters instead.`);
  const missing = t.pk.filter((p) => k[p] === undefined || k[p] === null);
  if (missing.length) throw new ToolError(`Pass the primary key for ${t.name}: ${t.pk.join(", ")}.`);
  return t.pk.map((p) => ({ column: p, op: "eq" as const, value: k[p] }));
}

const keyLabel = (filters: Filter[]) => filters.map((f) => String(f.value)).join("/");
const entityId = (filters: Filter[]) => {
  const v = filters.length === 1 ? String(filters[0].value) : "";
  return UUID.test(v) ? v : null;
};

function mayWrite(ctx: McpContext, t: Table) {
  if (t.readOnly) throw new ToolError(`${t.name} is read-only here.`);
  if (t.adminWrite && !ctx.user.admin) throw new ToolError(`Only admins can change ${t.name}.`);
}

function rowLabel(row: Row | undefined) {
  if (!row) return "";
  for (const k of ["title", "name", "full_name", "order_number", "slug", "email", "subject", "label"]) {
    if (typeof row[k] === "string" && row[k]) return String(row[k]).slice(0, 120);
  }
  return "";
}

// Dashboard activity feed, like changes made in the admin. Never throws.
async function activity(ctx: McpContext, t: Table, op: string, filters: Filter[] | null, detail: Row) {
  try {
    await ctx.db.from("activity_logs").insert({
      actor_id: ctx.user.id,
      action: `mcp.${t.name}.${op}`,
      entity_type: t.name,
      entity_id: filters ? entityId(filters) : null,
      details: { ...detail, via: "mcp", client_id: ctx.user.clientId || null },
    });
  } catch (e) {
    console.error("[mcp:activity]", e);
  }
}

async function countMatching(ctx: McpContext, t: Table, filters: Filter[]) {
  const q = applyFilters(t, ctx.db.from(t.name).select("*", { count: "exact", head: true }), filters);
  const { count, error } = await q;
  check(error);
  return count ?? 0;
}

async function sample(ctx: McpContext, t: Table, filters: Filter[], n = 10) {
  const { data, error } = await applyFilters(t, ctx.db.from(t.name).select("*"), filters).limit(n);
  check(error);
  return redact(t, (data ?? []) as Row[]);
}

// ---------------------------------------------------------------------------
// Confirmed actions
// ---------------------------------------------------------------------------
confirmable("record_delete", async (ctx, p) => {
  const t = await getTable(String(p.table));
  mayWrite(ctx, t);
  const filters = p.filters as Filter[];
  const { data, error } = await applyFilters(t, ctx.db.from(t.name).delete(), filters).select("*");
  check(error);
  const rows = (data ?? []) as Row[];
  if (!rows.length) throw new ToolError("Nothing was deleted: the records are already gone.");
  await activity(ctx, t, "delete", filters, { count: rows.length, labels: rows.slice(0, 20).map(rowLabel).filter(Boolean) });
  return { table: t.name, targetId: rows.length === 1 ? keyLabel(filters) : `${rows.length} rows`, data: { deleted: rows.length, rows: redact(t, rows).slice(0, 20) } };
});

confirmable("record_update_many", async (ctx, p) => {
  const t = await getTable(String(p.table));
  mayWrite(ctx, t);
  const filters = p.filters as Filter[];
  const patch = cleanRow(t, p.data as Row);
  const { data, error } = await applyFilters(t, ctx.db.from(t.name).update(patch), filters).select("*");
  check(error);
  const rows = (data ?? []) as Row[];
  await activity(ctx, t, "update_many", filters, { count: rows.length, fields: Object.keys(patch) });
  return { table: t.name, targetId: `${rows.length} rows`, data: { updated: rows.length, rows: redact(t, rows).slice(0, 20) } };
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export function registerRecordTools(server: McpServer, ctx: McpContext) {
  const domain = "records";

  defineTool(server, ctx, "tables_list", {
    domain, risk: "read", title: "List tables",
    description: "Every Ctrl+P table you can read and change: products, product_cards, content_items (blog posts, pages, emails, social), orders, pipeline_opportunities, bookings, digital_cards, production, users (customers and staff) and more. Start here, then table_describe.",
    inputSchema: z.object({
      search: z.string().max(60).optional().describe("Only tables whose name contains this"),
      refresh: z.boolean().optional().describe("Reload the schema (after a migration)"),
    }),
  }, async ({ search, refresh }) => {
    if (refresh) refreshSchema();
    const all = [...(await loadSchema()).values()]
      .filter((t) => !search || t.name.includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ table: t.name, primary_key: t.pk, columns: t.columns.length, ...(t.readOnly ? { read_only: true } : {}), ...(t.adminWrite ? { admin_only_changes: true } : {}) }));
    return { data: { tables: all, count: all.length } };
  });

  defineTool(server, ctx, "table_describe", {
    domain, risk: "read", title: "Describe a table",
    description: "Columns of one table: types, allowed values (enums), defaults, which are required on create, the primary key and foreign keys. Call before creating or updating.",
    inputSchema: z.object({ table: tableArg }),
  }, async ({ table }) => {
    const t = await getTable(table);
    return { table: t.name, data: describeTable(t) };
  });

  defineTool(server, ctx, "record_list", {
    domain, risk: "read", title: "List or search records",
    description: "Rows from one table with filters, text search, sorting and paging. Returns total count. Use columns to keep results small.",
    inputSchema: z.object({
      table: tableArg,
      columns: columnsArg,
      filters: filtersArg,
      q: z.string().trim().max(100).optional().describe("Case-insensitive text search across the table's text columns"),
      order_by: z.string().max(80).optional().describe("Column to sort by (default created_at if present)"),
      ascending: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(200).default(25),
      offset: z.number().int().min(0).max(100_000).default(0),
    }),
  }, async ({ table, columns, filters, q, order_by, ascending, limit, offset }) => {
    const t = await getTable(table);
    let query = applyFilters(t, ctx.db.from(t.name).select(selectList(t, columns), { count: "exact" }), filters as Filter[]);
    const term = q?.replace(/[,()*%\\]/g, " ").trim();
    if (term) {
      const textCols = t.columns.filter((c) => c.type === "string" && (c.format === "text" || c.format === "character varying") && !c.hidden);
      if (!textCols.length) throw new ToolError(`${t.name} has no text columns to search. Use filters.`);
      query = query.or(textCols.map((c) => `${c.name}.ilike.*${term}*`).join(","));
    }
    const sortCol = order_by ?? (t.columns.some((c) => c.name === "created_at") ? "created_at" : t.pk[0]);
    if (sortCol) {
      column(t, sortCol);
      query = query.order(sortCol, { ascending, nullsFirst: false });
    }
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    check(error);
    const rows = (data ?? []) as Row[];
    return {
      table: t.name,
      data: { table: t.name, total: count, offset, returned: rows.length, next_offset: count != null && offset + rows.length < count ? offset + rows.length : null, rows: redact(t, rows) },
    };
  });

  defineTool(server, ctx, "record_get", {
    domain, risk: "read", title: "Get one record",
    description: "One row by primary key (id, or key for composite keys).",
    inputSchema: z.object({ table: tableArg, id: idArg, key: keyArg, columns: columnsArg }),
  }, async ({ table, id, key, columns }) => {
    const t = await getTable(table);
    const filters = keyFilters(t, id, key);
    const { data, error } = await applyFilters(t, ctx.db.from(t.name).select(selectList(t, columns)), filters).maybeSingle();
    check(error);
    if (!data) throw new ToolError(`No ${t.name} record with ${keyLabel(filters)}.`);
    return { table: t.name, targetId: keyLabel(filters), data: { table: t.name, row: redact(t, data as Row) } };
  });

  defineTool(server, ctx, "record_create", {
    domain, risk: "write", title: "Create records",
    description: "Insert one row (data as an object) or up to 100 (data as an array). Columns must exist (table_describe); defaults fill the rest. Returns the created rows.",
    inputSchema: z.object({
      table: tableArg,
      data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown())).min(1).max(100)]),
      upsert: z.boolean().optional().describe("Update the row instead if its primary key already exists"),
    }),
  }, async ({ table, data, upsert }) => {
    const t = await getTable(table);
    mayWrite(ctx, t);
    const rows = (Array.isArray(data) ? data : [data]).map((r) => cleanRow(t, r));
    const base = ctx.db.from(t.name);
    const { data: created, error } = await (upsert ? base.upsert(rows, { onConflict: t.pk.join(",") || undefined }) : base.insert(rows)).select("*");
    check(error);
    const out = (created ?? []) as Row[];
    const first = out[0];
    await activity(ctx, t, upsert ? "upsert" : "create", first && t.pk.length ? t.pk.map((p) => ({ column: p, op: "eq" as const, value: first[p] })) : null, {
      count: out.length, labels: out.slice(0, 20).map(rowLabel).filter(Boolean),
    });
    return {
      table: t.name,
      targetId: out.length === 1 && t.pk.length ? t.pk.map((p) => String(first[p])).join("/") : `${out.length} rows`,
      data: { table: t.name, created: out.length, rows: redact(t, out) },
    };
  });

  defineTool(server, ctx, "record_update", {
    domain, risk: "write", title: "Update records",
    description: "Change columns of one row (by id or key). To change many rows at once pass filters instead: that returns a preview and a confirmation_id for confirm_action (admins only).",
    inputSchema: z.object({
      table: tableArg, id: idArg, key: keyArg, filters: filtersArg,
      data: z.record(z.string(), z.unknown()).describe("Only the columns to change"),
    }),
  }, async ({ table, id, key, filters, data }) => {
    const t = await getTable(table);
    mayWrite(ctx, t);
    const patch = cleanRow(t, data);
    if (!Object.keys(patch).length) throw new ToolError("Pass at least one column to change.");

    if (id == null && !(key && Object.keys(key).length)) {
      if (!filters?.length) throw new ToolError("Pass id or key for one row, or filters for many.");
      if (!ctx.user.admin) throw new ToolError("Only admins can change many records at once.");
      const fs = filters as Filter[];
      const n = await countMatching(ctx, t, fs);
      if (!n) throw new ToolError("No records match those filters.");
      const out = await prepare(ctx, "record_update_many", { table: t.name, filters: fs, data: patch },
        `Update ${n} ${t.name} record${n === 1 ? "" : "s"}: set ${Object.keys(patch).join(", ")}`,
        { matching: n, set: redact(t, patch), sample: await sample(ctx, t, fs) });
      return { ...out, table: t.name };
    }

    const fs = keyFilters(t, id, key);
    const { data: updated, error } = await applyFilters(t, ctx.db.from(t.name).update(patch), fs).select("*").maybeSingle();
    check(error);
    if (!updated) throw new ToolError(`No ${t.name} record with ${keyLabel(fs)}.`);
    await activity(ctx, t, "update", fs, { label: rowLabel(updated as Row), fields: Object.keys(patch) });
    return { table: t.name, targetId: keyLabel(fs), data: { table: t.name, updated: redact(t, updated as Row) } };
  });

  defineTool(server, ctx, "record_delete", {
    domain, risk: "high", title: "Delete records",
    description: "Permanently delete one row (id or key) or every row matching filters. Nothing is deleted yet: returns a preview and a confirmation_id. Show the person, and only after a clear yes call confirm_action. Admins only. Prefer archiving (a status column) when the table has one.",
    inputSchema: z.object({ table: tableArg, id: idArg, key: keyArg, filters: filtersArg }),
  }, async ({ table, id, key, filters }) => {
    const t = await getTable(table);
    mayWrite(ctx, t);
    if (!ctx.user.admin) throw new ToolError("Only admins can delete records.");
    const single = id != null || !!(key && Object.keys(key).length);
    if (!single && !filters?.length) throw new ToolError("Pass id or key for one row, or filters for many.");
    const fs = single ? keyFilters(t, id, key) : (filters as Filter[]);
    const n = await countMatching(ctx, t, fs);
    if (!n) throw new ToolError("No records match.");
    const rows = await sample(ctx, t, fs);
    const what = single ? `the ${t.name} record ${rowLabel(rows[0]) ? `"${rowLabel(rows[0])}"` : keyLabel(fs)}` : `${n} ${t.name} record${n === 1 ? "" : "s"}`;
    const out = await prepare(ctx, "record_delete", { table: t.name, filters: fs }, `Permanently delete ${what}`, { matching: n, sample: rows });
    return { ...out, table: t.name, targetId: single ? keyLabel(fs) : `${n} rows` };
  });
}
