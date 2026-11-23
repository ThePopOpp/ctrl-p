import { ToolError } from "./audit";

// Live schema of the public tables, read from PostgREST's OpenAPI document
// (service role). New tables and columns show up without code changes.
// Cached per process for 5 minutes; call refreshSchema() after migrations.

export type Column = {
  name: string;
  type: string; // string, integer, number, boolean, array, object
  format: string | null; // uuid, timestamp with time zone, jsonb, public.order_status...
  enum: string[] | null;
  default: string | null;
  required: boolean; // NOT NULL
  pk: boolean;
  fk: string | null; // "table.column"
  hidden: boolean; // secret-looking: value never returned
};

export type Table = {
  name: string;
  description: string | null;
  columns: Column[];
  pk: string[];
  readOnly: boolean;
  adminWrite: boolean; // only super_admin/admin may change it
};

// Never exposed: the connector's own confirmations.
const HIDDEN_TABLES = new Set(["mcp_confirmations"]);
// Visible but never changed through the MCP.
const READ_ONLY_TABLES = new Set(["mcp_audit_log"]);
// Changing these changes who can do what: admins only.
const ADMIN_WRITE_TABLES = new Set(["users"]);

const SECRET_COLUMN = /(^|_)(token|secret|password|passwd|api_key|apikey|private_key|refresh_token|access_token|p256dh|auth_key|keys)($|_)/i;

let cache: { at: number; tables: Map<string, Table> } | null = null;
const TTL_MS = 5 * 60_000;

type OpenApiProp = { type?: string; format?: string; enum?: string[]; default?: unknown; description?: string };
type OpenApiDef = { description?: string; required?: string[]; properties?: Record<string, OpenApiProp> };

export function refreshSchema() {
  cache = null;
}

export async function loadSchema(): Promise<Map<string, Table>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tables;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Schema introspection failed: ${res.status}`);
  const doc = (await res.json()) as { definitions?: Record<string, OpenApiDef> };

  const tables = new Map<string, Table>();
  for (const [name, def] of Object.entries(doc.definitions ?? {})) {
    if (HIDDEN_TABLES.has(name)) continue;
    const required = new Set(def.required ?? []);
    const columns: Column[] = Object.entries(def.properties ?? {}).map(([col, p]) => {
      const desc = p.description ?? "";
      const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/);
      return {
        name: col,
        type: p.type ?? "string",
        format: p.format ?? null,
        enum: p.enum ?? null,
        default: p.default === undefined ? null : String(p.default),
        required: required.has(col),
        pk: desc.includes("<pk/>"),
        fk: fk ? `${fk[1]}.${fk[2]}` : null,
        hidden: SECRET_COLUMN.test(col),
      };
    });
    const pk = columns.filter((c) => c.pk).map((c) => c.name);
    tables.set(name, {
      name,
      description: def.description?.trim() || null,
      columns,
      pk: pk.length ? pk : columns.some((c) => c.name === "id") ? ["id"] : [],
      readOnly: READ_ONLY_TABLES.has(name),
      adminWrite: ADMIN_WRITE_TABLES.has(name),
    });
  }
  cache = { at: Date.now(), tables };
  return tables;
}

export async function getTable(name: string): Promise<Table> {
  const t = (await loadSchema()).get(name);
  if (!t) throw new ToolError(`There's no table called "${name}". Call tables_list to see them.`);
  return t;
}

export function column(t: Table, name: string): Column {
  const c = t.columns.find((x) => x.name === name);
  if (!c) throw new ToolError(`${t.name} has no column "${name}". Call table_describe for its columns.`);
  return c;
}

// Replace secret-looking values before anything is returned to the AI app.
export function redact<T>(t: Table, rows: T): T {
  const hidden = t.columns.filter((c) => c.hidden).map((c) => c.name);
  if (!hidden.length) return rows;
  const scrub = (r: unknown) => {
    if (!r || typeof r !== "object") return r;
    const copy = { ...(r as Record<string, unknown>) };
    for (const h of hidden) if (h in copy && copy[h] != null) copy[h] = "[hidden]";
    return copy;
  };
  return (Array.isArray(rows) ? rows.map(scrub) : scrub(rows)) as T;
}

export function describeTable(t: Table) {
  return {
    table: t.name,
    description: t.description,
    primary_key: t.pk,
    read_only: t.readOnly || undefined,
    admin_only_changes: t.adminWrite || undefined,
    columns: t.columns.map((c) => ({
      name: c.name,
      type: c.format && c.format !== c.type ? `${c.type} (${c.format})` : c.type,
      ...(c.enum ? { allowed: c.enum } : {}),
      ...(c.default ? { default: c.default } : {}),
      ...(c.required && !c.default ? { required_on_create: true } : {}),
      ...(c.pk ? { primary_key: true } : {}),
      ...(c.fk ? { references: c.fk } : {}),
      ...(c.hidden ? { secret: "write-only; reads show [hidden]" } : {}),
    })),
  };
}

// Checks keys against real columns before a write.
export function cleanRow(t: Table, row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new ToolError("data must be an object of column: value.");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const c = column(t, k);
    if (c.enum && v != null && !c.enum.includes(String(v))) {
      throw new ToolError(`${t.name}.${k} must be one of: ${c.enum.join(", ")}.`);
    }
    out[k] = v;
  }
  return out;
}
