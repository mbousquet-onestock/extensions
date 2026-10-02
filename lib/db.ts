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

export async function tableColumns(table: string) {
  const rows = await getSql()`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND table_schema = current_schema()
    ORDER BY ordinal_position`;
  return rows.map((r) => r.column_name as string);
}
