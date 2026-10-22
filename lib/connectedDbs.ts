import { describeUrl, directUrl } from "@/lib/dbCopy.mjs";

// Bases reliées au projet Vercel (Storage → la base → « Connect Project ») : Vercel crée leurs variables
// de connexion, avec le préfixe choisi à la connexion (ex. QUALIF_DATABASE_URL, PROD_DATABASE_URL_UNPOOLED).
// Le préfixe sert de nom ; la base de l'application elle-même (sans préfixe) s'appelle « app ».

const URL_VARS = /^(?:(.+?)_)?(DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|DATABASE_URL|POSTGRES_URL)$/;
// Variable préférée pour une même base : URL directe d'abord.
const PREFERENCE = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL", "POSTGRES_URL"];

export type ConnectedDatabase = { name: string; host: string };

function scan() {
  const byPrefix = new Map<string, { kind: string; url: string }>();
  for (const [key, value] of Object.entries(process.env)) {
    const m = key.match(URL_VARS);
    if (!m || !value || !/^postgres(ql)?:\/\//i.test(value)) continue;
    const prefix = m[1] ?? "";
    // Exclut les variables propres à l'application qui ne désignent pas une base reliée.
    if (/^(SOURCE|TARGET|COPY)$/.test(prefix)) continue;
    const current = byPrefix.get(prefix);
    if (!current || PREFERENCE.indexOf(m[2]) < PREFERENCE.indexOf(current.kind)) byPrefix.set(prefix, { kind: m[2], url: value });
  }
  const seen = new Set<string>();
  const result: (ConnectedDatabase & { url: string })[] = [];
  for (const [prefix, { url }] of [...byPrefix].sort(([a], [b]) => a.localeCompare(b))) {
    let host: string;
    try {
      host = describeUrl(url);
    } catch {
      continue;
    }
    if (seen.has(host)) continue; // même base sous deux préfixes
    seen.add(host);
    result.push({ name: prefix ? prefix.toLowerCase().replace(/_/g, "-") : "app", host, url: directUrl(url) });
  }
  return result;
}

/** Bases reliées au projet, sans leurs URL (pour l'affichage). */
export const connectedDatabases = (): ConnectedDatabase[] => scan().map(({ name, host }) => ({ name, host }));

/** URL d'une base reliée, par son nom (insensible à la casse, `_` ou `-`). */
export function connectedDatabaseUrl(name: string) {
  const n = name.trim().toLowerCase().replace(/_/g, "-");
  return scan().find((d) => d.name === n) ?? null;
}
