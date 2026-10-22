import { timingSafeEqual } from "node:crypto";
import { describeUrl } from "@/lib/dbCopy.mjs";

// Bases proposées dans l'onglet « Copie de base » : une variable d'environnement par base,
// COPY_DB_<NOM>=<URL de connexion directe>. Les URL ne sont jamais envoyées au navigateur.

const PREFIX = "COPY_DB_";

export type CopyDatabase = { name: string; label: string; host: string };

export function copyDatabases(): CopyDatabase[] {
  return Object.entries(process.env)
    .filter(([k, v]) => k.startsWith(PREFIX) && v)
    .map(([k, v]) => {
      const name = k.slice(PREFIX.length);
      let host = "?";
      try {
        host = describeUrl(v!);
      } catch {}
      return { name, label: name.toLowerCase().replace(/_/g, " "), host };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** URL d'une base de la liste, côté serveur uniquement. */
export function copyDatabaseUrl(name: string) {
  return /^[A-Z0-9_]+$/.test(name) ? process.env[PREFIX + name] || null : null;
}

export const copyEnabled = () => !!process.env.COPY_ADMIN_PASSWORD?.trim();

export function checkCopyPassword(given: string) {
  const expected = process.env.COPY_ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
