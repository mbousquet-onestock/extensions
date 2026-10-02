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

let extensionsTable: Promise<unknown> | null = null;

// Crée la table extensions au premier accès si elle n'existe pas encore.
export function ensureExtensionsTable() {
  extensionsTable ??= getSql()`
    CREATE TABLE IF NOT EXISTS extensions (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      installation_point TEXT NOT NULL,
      installed          BOOLEAN NOT NULL DEFAULT false,
      settings_url       TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.catch((e) => {
    extensionsTable = null;
    throw e;
  });
  return extensionsTable;
}

export type Extension = {
  id: string;
  name: string;
  installation_point: string;
  installed: boolean;
  settings_url: string | null;
};

export function settingsLink(ext: Pick<Extension, "settings_url">) {
  return ext.settings_url || process.env.VERCEL_SETTINGS_URL || null;
}
