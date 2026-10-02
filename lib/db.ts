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
