import { getSql, isWritableColumn, tableColumns } from "@/lib/db";
import { summarizeError } from "@/lib/payload";

export const LOGS_TABLE = "api_logs";

/** Rôle de chaque colonne de api_logs, détecté d'après son nom (le schéma n'est pas figé). */
const ROLES = {
  time: ["created_at", "timestamp", "time", "date", "logged_at"],
  api: ["api", "source", "target", "service", "kind", "type"],
  method: ["method", "http_method", "verb"],
  path: ["path", "url", "endpoint", "route"],
  status: ["status", "status_code", "http_status", "code"],
  duration: ["duration_ms", "duration", "elapsed_ms", "latency_ms", "time_ms"],
  result: ["result", "summary", "message"],
  error: ["error", "error_message", "err"],
  request: ["request", "request_body", "body", "params", "payload", "input"],
  response: ["response", "response_body", "output", "data"],
  site: ["site_id", "site"],
  id: ["id"],
} as const;

export type Role = keyof typeof ROLES;
export type ColumnMap = Partial<Record<Role, string>>;

export function mapColumns(columns: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const [role, names] of Object.entries(ROLES) as [Role, readonly string[]][]) {
    const found = names.find((n) => columns.includes(n));
    if (found) map[role] = found;
  }
  return map;
}

const q = (c: string) => `"${c.replace(/"/g, '""')}"`;

export type LogFilters = { siteId?: string; api?: string; errorsOnly?: boolean; search?: string };

function errorCondition(map: ColumnMap) {
  const parts: string[] = [];
  if (map.status) parts.push(`(CASE WHEN ${q(map.status)}::text ~ '^[0-9]+$' THEN ${q(map.status)}::text::int >= 400 ELSE false END)`);
  if (map.error) parts.push(`(${q(map.error)} IS NOT NULL AND ${q(map.error)}::text <> '')`);
  return parts.length ? `(${parts.join(" OR ")})` : "false";
}

function buildWhere(map: ColumnMap, filters: LogFilters, { withErrors = true } = {}) {
  const where: string[] = [];
  const args: string[] = [];
  if (filters.siteId && map.site) {
    args.push(filters.siteId);
    where.push(`${q(map.site)}::text = $${args.length}`);
  }
  if (filters.api && map.api) {
    args.push(filters.api);
    where.push(`${q(map.api)}::text = $${args.length}`);
  }
  if (filters.search) {
    args.push(`%${filters.search}%`);
    where.push(`l::text ILIKE $${args.length}`);
  }
  if (withErrors && filters.errorsOnly) where.push(errorCondition(map));
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", args };
}

export async function readLogs(filters: LogFilters, limit: number) {
  const columns = await tableColumns(LOGS_TABLE);
  if (columns.length === 0) return null;
  const map = mapColumns(columns);
  const sql = getSql();
  const order = map.time ? `${q(map.time)} DESC` : map.id ? `${q(map.id)} DESC` : "1";

  const all = buildWhere(map, filters);
  const noErr = buildWhere(map, filters, { withErrors: false });
  const [rows, total, errors, apis] = await Promise.all([
    sql.query(`SELECT * FROM ${LOGS_TABLE} l ${all.sql} ORDER BY ${order} LIMIT ${limit}`, all.args),
    sql.query(`SELECT count(*)::int AS n FROM ${LOGS_TABLE} l ${all.sql}`, all.args),
    sql.query(
      `SELECT count(*)::int AS n FROM ${LOGS_TABLE} l ${noErr.sql} ${noErr.sql ? "AND" : "WHERE"} ${errorCondition(map)}`,
      noErr.args,
    ),
    map.api
      ? sql.query(`SELECT DISTINCT ${q(map.api)}::text AS v FROM ${LOGS_TABLE} WHERE ${q(map.api)} IS NOT NULL ORDER BY 1`)
      : Promise.resolve([]),
  ]);
  return {
    columns,
    map,
    rows: rows as Record<string, unknown>[],
    total: (total as { n: number }[])[0].n,
    errors: (errors as { n: number }[])[0].n,
    apis: (apis as { v: string }[]).map((r) => r.v),
  };
}

export async function clearLogs(siteId?: string) {
  const columns = await tableColumns(LOGS_TABLE);
  const map = mapColumns(columns);
  const where = siteId && map.site ? `WHERE ${q(map.site)}::text = $1` : "";
  const rows = await getSql().query(
    `WITH d AS (DELETE FROM ${LOGS_TABLE} ${where} RETURNING 1) SELECT count(*)::int AS n FROM d`,
    where ? [siteId] : [],
  );
  return (rows as { n: number }[])[0].n;
}

// ---------- Masquage des secrets ----------

const SECRET_KEY = /token|secret|password|passwd|api_?key|authorization|credential|signature/i;

// Aucun caractère d'un secret n'est conservé.
function maskString(_v: string) {
  return "••••••••";
}

export function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) && (typeof v === "string" || typeof v === "number") ? maskString(String(v)) : maskSecrets(v),
      ]),
    );
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 1) {
      try {
        return maskSecrets(JSON.parse(trimmed));
      } catch {}
    }
    // Paramètres d'URL ou "token=…" dans un texte libre.
    return value.replace(/([?&\s"]?(?:token|secret|password|api_?key|signature)["]?\s*[=:]\s*"?)([^&\s",}]+)/gi, (_, k, v) => k + maskString(v));
  }
  return value;
}

/** Texte lisible (JSON indenté si possible) d'une valeur, secrets masqués. */
export function pretty(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const masked = maskSecrets(value);
  return typeof masked === "string" ? masked : JSON.stringify(masked, null, 2);
}

// ---------- Mise en forme d'une ligne ----------

export type Entry = {
  key: string;
  time: unknown;
  api: string | null;
  method: string | null;
  path: string;
  status: number | null;
  duration: string | null;
  result: string;
  isError: boolean;
  request: string;
  response: string;
  error: string;
};

export function toEntry(
  row: Record<string, unknown>,
  map: ColumnMap,
  index: number,
  words: { entries: (n: number) => string; ok: string },
): Entry {
  const get = (role: Role) => (map[role] ? row[map[role]!] : undefined);
  const statusRaw = Number(get("status"));
  const status = Number.isFinite(statusRaw) && get("status") !== null && get("status") !== undefined ? statusRaw : null;
  const durationRaw = get("duration");
  const error = pretty(get("error"));
  const responseValue = get("response");
  const isError = !!error || (status !== null && status >= 400);

  let result = error ? summarizeError(error) : pretty(get("result")).replace(/\s+/g, " ");
  if (!result) {
    const parsed = typeof responseValue === "string" ? safeParse(responseValue) : responseValue;
    if (Array.isArray(parsed)) result = words.entries(parsed.length);
    else if (isError && responseValue) result = summarizeError(pretty(responseValue));
    else if (status !== null && status < 400) result = words.ok;
  }

  return {
    key: String(get("id") ?? index),
    time: get("time"),
    api: get("api") != null ? String(get("api")) : null,
    method: get("method") != null ? String(get("method")).toUpperCase() : null,
    path: pretty(get("path")),
    status,
    duration: durationRaw != null && durationRaw !== "" ? `${Math.round(Number(durationRaw))} ms` : null,
    result: result.length > 300 ? `${result.slice(0, 300)}…` : result,
    isError,
    request: pretty(get("request")),
    response: pretty(responseValue),
    error,
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ---------- Écriture d'un appel ----------

export type ApiCall = {
  siteId?: string;
  api: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  request?: unknown;
  response?: unknown;
  error?: string | null;
  result?: string | null;
};

let logColumns: Promise<string[]> | null = null;

/** Enregistre un appel dans api_logs, dans les colonnes qui existent (secrets masqués). */
export async function logApiCall(call: ApiCall) {
  logColumns ??= tableColumns(LOGS_TABLE).catch((e) => {
    logColumns = null;
    throw e;
  });
  const columns = await logColumns;
  if (columns.length === 0) return;
  const map = mapColumns(columns);

  const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(maskSecrets(v)));
  const values: Partial<Record<Role, unknown>> = {
    time: new Date().toISOString(),
    site: call.siteId ?? null,
    api: call.api,
    method: call.method,
    path: maskSecrets(call.path),
    status: call.status,
    duration: call.durationMs,
    request: json(call.request),
    response: json(call.response),
    error: call.error ? maskSecrets(call.error) : null,
    result: call.result ?? null,
  };
  const cols: string[] = [];
  const args: unknown[] = [];
  for (const [role, value] of Object.entries(values) as [Role, unknown][]) {
    const col = map[role];
    if (!col || cols.includes(q(col)) || !(await isWritableColumn(LOGS_TABLE, col))) continue;
    cols.push(q(col));
    args.push(value);
  }
  if (cols.length === 0) return;
  await getSql().query(
    `INSERT INTO ${LOGS_TABLE} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    args,
  );
}
