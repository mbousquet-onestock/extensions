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

// Crée la table extensions (catalogue) au premier accès si elles n'existent pas encore.
export function ensureSchema() {
  schema ??= (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS extensions (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        installation_point TEXT,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    // Mêmes champs que l'API OneStock (l'id OneStock, lui, est propre à chaque environnement).
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS description TEXT`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS icon TEXT`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS url TEXT`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS test_url TEXT`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS rank INTEGER`;
    await sql`ALTER TABLE extensions ADD COLUMN IF NOT EXISTS injection_points JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE extensions ALTER COLUMN installation_point DROP NOT NULL`;
  })().catch((e) => {
    schema = null;
    throw e;
  });
  return schema;
}

export type CatalogInjectionPoint = { anchor: string; name?: string; slug?: string; path?: string; icon?: string };

/** Extension du catalogue (commun à tous les sites et environnements). */
export type Extension = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  url: string | null;
  test_url: string | null;
  /** Ordre d'affichage dans OneStock (`rank`). */
  rank: number | null;
  injection_points: CatalogInjectionPoint[];
  updated_at?: Date;
};

/** Lien entre catalogue et extensions installées : le nom (l'id OneStock change selon l'environnement). */
export const nameKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

export async function readCatalog(): Promise<Extension[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, name, description, icon, url, test_url, rank, injection_points, installation_point, updated_at
    FROM extensions ORDER BY name`;
  return rows.map((r) => {
    const points = Array.isArray(r.injection_points) ? (r.injection_points as CatalogInjectionPoint[]) : [];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      url: r.url,
      test_url: r.test_url,
      rank: r.rank ?? null,
      updated_at: r.updated_at,
      // Anciennes lignes : un seul point d'installation.
      injection_points: points.length || !r.installation_point ? points : [{ anchor: r.installation_point, name: r.name }],
    };
  });
}

export type Row = Record<string, unknown>;

export async function tableColumns(table: string) {
  const rows = await getSql()`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND table_schema = current_schema()
    ORDER BY ordinal_position`;
  return rows.map((r) => r.column_name as string);
}

const writable = new Map<string, Promise<boolean>>();

/** Faux si la colonne n'existe pas ou si elle est générée / identité « ALWAYS » (non modifiable). */
export function isWritableColumn(table: string, column: string) {
  const id = `${table}.${column}`;
  if (!writable.has(id)) {
    writable.set(
      id,
      getSql()`
        SELECT is_generated, is_identity, identity_generation FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${column} AND table_schema = current_schema()`
        .then(([c]) => !!c && c.is_generated !== "ALWAYS" && !(c.is_identity === "YES" && c.identity_generation === "ALWAYS"))
        .catch((e) => {
          writable.delete(id);
          throw e;
        }),
    );
  }
  return writable.get(id)!;
}
