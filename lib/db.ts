import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL (ou POSTGRES_URL) n'est pas défini.");
  }
  client ??= neon(url);
  return client;
}

let schema: Promise<unknown> | null = null;

// Crée les tables extensions et site_extensions au premier accès si elles n'existent pas encore.
export function ensureSchema() {
  schema ??= (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS extensions (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        installation_point TEXT NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS description TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS site_extensions (
        site_id      TEXT NOT NULL,
        extension_id TEXT NOT NULL REFERENCES extensions (id) ON DELETE CASCADE,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (site_id, extension_id)
      )`;
  })().catch((e) => {
    schema = null;
    throw e;
  });
  return schema;
}

export type Extension = {
  id: string;
  name: string;
  installation_point: string;
  description: string | null;
};

export type Row = Record<string, unknown>;

const IDENT = /^[a-z_][a-z0-9_]*$/i;

export function quoteIdent(name: string) {
  if (!IDENT.test(name)) throw new Error(`Nom de table ou colonne invalide : ${name}`);
  return `"${name}"`;
}

export async function tableColumns(table: string) {
  const rows = await getSql()`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND table_schema = current_schema()
    ORDER BY ordinal_position`;
  return rows.map((r) => r.column_name as string);
}

/**
 * Lit les lignes d'une table existante en filtrant sur les colonnes connues.
 * Un filtre dont la colonne n'existe pas dans la table est ignoré ;
 * une valeur `null` filtre sur `IS NULL`.
 */
export async function readTable(table: string, filters: Record<string, string | null | undefined>) {
  const columns = await tableColumns(table);
  if (columns.length === 0) return { exists: false, columns, rows: [] as Row[], applied: [] as string[] };

  const where: string[] = [];
  const args: unknown[] = [];
  const applied: string[] = [];
  for (const [column, value] of Object.entries(filters)) {
    if (value === undefined || !columns.includes(column)) continue;
    applied.push(column);
    if (value === null) {
      where.push(`${quoteIdent(column)} IS NULL`);
    } else {
      args.push(value);
      where.push(`${quoteIdent(column)}::text = $${args.length}`);
    }
  }
  const order = ["key", "name", "id"].find((c) => columns.includes(c));
  const rows = (await getSql().query(
    `SELECT * FROM ${quoteIdent(table)}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ${order ? `ORDER BY ${quoteIdent(order)}` : ""}
     LIMIT 1000`,
    args,
  )) as Row[];
  return { exists: true, columns, rows, applied };
}

export const SETTINGS_TABLE = process.env.SETTINGS_TABLE || "settings";
export const GENERAL_SETTINGS_TABLE = process.env.GENERAL_SETTINGS_TABLE || "general_settings";

export async function listTables() {
  const rows = await getSql()`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() ORDER BY table_name`;
  return rows.map((r) => r.table_name as string);
}
