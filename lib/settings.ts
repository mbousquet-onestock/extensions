import { getSql, isWritableColumn } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncrypted, isSecretKey } from "@/lib/secrets";

export type Setting = {
  /** Setting sensible : `value` est toujours vide côté interface (jamais lue ni affichée). */
  secret?: boolean;
  encrypted?: boolean;
  key: string;
  value: string;
  updated_at: Date;
  site_id: string;
  extension_id: string;
  environment: string;
  scope: string | null;
};

const WILDCARDS = ["*", ""];

export const isWildcard = (v: string | null | undefined) => v == null || WILDCARDS.includes(v);

/**
 * Lit la table settings. `*` (ou vide) dans site_id vaut pour tous les sites.
 * - extensionId : settings de cette extension
 * - sinon : settings généraux (scope = 'global' ou extension_id = '*')
 */
/** Site « global » : site_id vide (ou NULL, ou `*`) = valeur commune à tous les sites. */
export const GLOBAL_SITE_SQL = "(site_id IS NULL OR site_id IN ('', '*'))";

export async function getSettings({
  extensionId,
  siteId,
  siteOnly = false,
}: {
  extensionId?: string | string[];
  siteId?: string;
  /** Vrai : uniquement les lignes du site (sans les globales) ; sans site, uniquement les globales. */
  siteOnly?: boolean;
}) {
  const where: string[] = [];
  const args: (string | string[])[] = [];
  const ids = [extensionId ?? []].flat().filter(Boolean);
  if (ids.length) {
    args.push(ids);
    where.push(`extension_id = ANY($${args.length})`);
  } else {
    where.push(`(scope = 'global' OR extension_id = '*')`);
  }
  if (siteId) {
    args.push(siteId);
    where.push(siteOnly ? `site_id = $${args.length}` : `(site_id = $${args.length} OR ${GLOBAL_SITE_SQL})`);
  } else if (siteOnly) {
    where.push(GLOBAL_SITE_SQL);
  }
  const rows = await getSql().query(
    `SELECT key, value, updated_at, site_id, extension_id, environment, scope
     FROM settings WHERE ${where.join(" AND ")}
     ORDER BY key, environment, site_id`,
    args,
  );
  // Les valeurs sensibles ne quittent jamais cette fonction : seul leur état (chiffré ou non) est exposé.
  return (rows as Setting[]).map((r) =>
    isSecretKey(r.key) ? { ...r, value: "", secret: true, encrypted: isEncrypted(r.value) } : r,
  );
}

/** Un setting « tous les sites » est remplacé s'il existe la même clé pour le site précis. */
export function isOverridden(row: Setting, rows: Setting[]) {
  return (
    isWildcard(row.site_id) &&
    rows.some(
      (r) =>
        r !== row &&
        !isWildcard(r.site_id) &&
        r.key === row.key &&
        r.environment === row.environment &&
        r.extension_id === row.extension_id,
    )
  );
}

/**
 * Copie les variables globales d'une extension (site_id vide) sur un site, pour un environnement.
 * Les valeurs existantes du site ne sont pas écrasées ; les valeurs chiffrées sont copiées telles quelles.
 * Renvoie le nombre de variables copiées.
 */
export async function copyGlobalSettingsToSite(extensionIds: string[], siteId: string, environment: string) {
  const ids = [...new Set(extensionIds.filter(Boolean))];
  if (!ids.length || !siteId) return 0;
  const withScope = await isWritableColumn("settings", "scope");
  const rows = await getSql().query(
    `WITH copied AS (
       INSERT INTO settings (key, value, site_id, extension_id, environment, ${withScope ? "scope, " : ""}updated_at)
       SELECT g.key, g.value, $2, g.extension_id, g.environment, ${withScope ? "g.scope, " : ""}now()
       FROM settings g
       WHERE g.extension_id = ANY($1) AND g.environment = $3
         AND (g.site_id IS NULL OR g.site_id IN ('', '*'))
         AND NOT EXISTS (
           SELECT 1 FROM settings s
           WHERE s.key = g.key AND s.extension_id = g.extension_id AND s.environment = g.environment AND s.site_id = $2
         )
       ON CONFLICT DO NOTHING
       RETURNING 1
     )
     SELECT count(*)::int AS n FROM copied`,
    [ids, siteId, environment],
  );
  return (rows as { n: number }[])[0].n;
}

// ---------- Accès CRUD (API /api/settings) ----------

/** Identifiant d'un setting : clé primaire de la table (site_id peut être vide = global). */
export type SettingId = { key: string; site_id: string; extension_id: string; environment: string };

export type SettingRecord = SettingId & {
  value: string | null;
  scope: string | null;
  updated_at: Date;
  secret: boolean;
  encrypted: boolean;
  decrypt_error?: boolean;
};

export type SettingFilters = Partial<Record<"key" | "site_id" | "extension_id" | "environment" | "scope", string>>;

/** Valeur exposée : un secret n'est renvoyé (déchiffré) que si `decrypt` est demandé, sinon null. */
function toRecord(r: Record<string, unknown>, decrypt: boolean): SettingRecord {
  const key = String(r.key);
  const raw = r.value == null ? null : String(r.value);
  const secret = isSecretKey(key);
  let value: string | null = !secret ? raw : null;
  let decryptError = false;
  if (secret && decrypt && raw != null) {
    try {
      value = decryptSecret(raw);
    } catch {
      decryptError = true; // mauvaise clé ou valeur corrompue : la ligne est renvoyée sans valeur
    }
  }
  return {
    key,
    site_id: (r.site_id as string) ?? "",
    extension_id: String(r.extension_id),
    environment: String(r.environment),
    scope: (r.scope as string) ?? null,
    updated_at: r.updated_at as Date,
    secret,
    encrypted: isEncrypted(raw),
    value,
    ...(decryptError && { decrypt_error: true }),
  };
}

export async function listSettings(filters: SettingFilters, { decrypt = false, limit = 1000 } = {}) {
  const where: string[] = [];
  const args: string[] = [];
  for (const col of ["key", "site_id", "extension_id", "environment", "scope"] as const) {
    const v = filters[col];
    if (v === undefined) continue;
    if (col === "site_id" && v === "") {
      where.push("(site_id IS NULL OR site_id = '')"); // site_id vide = global
      continue;
    }
    args.push(v);
    where.push(`${col} = $${args.length}`);
  }
  const rows = await getSql().query(
    `SELECT key, value, updated_at, site_id, extension_id, environment, scope FROM settings
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY key, extension_id, environment, site_id LIMIT ${Math.min(Math.max(1, limit), 5000)}`,
    args,
  );
  return (rows as Record<string, unknown>[]).map((r) => toRecord(r, decrypt));
}

const ID_WHERE = "key = $1 AND COALESCE(site_id, '') = $2 AND extension_id = $3 AND environment = $4";
const idArgs = (id: SettingId) => [id.key, id.site_id ?? "", id.extension_id, id.environment];

export async function readSetting(id: SettingId, { decrypt = false } = {}) {
  const [row] = (await getSql().query(
    `SELECT key, value, updated_at, site_id, extension_id, environment, scope FROM settings WHERE ${ID_WHERE}`,
    idArgs(id),
  )) as Record<string, unknown>[];
  return row ? toRecord(row, decrypt) : null;
}

/** Valeur stockée : chiffrée pour une clé sensible (lève MissingKeyError sans SETTINGS_ENCRYPTION_KEY). */
const storedValue = (key: string, value: string) => (isSecretKey(key) ? encryptSecret(value) : value);

export async function createSetting(input: SettingId & { value: string; scope?: string | null }) {
  const withScope = input.scope !== undefined && (await isWritableColumn("settings", "scope"));
  await getSql().query(
    `INSERT INTO settings (key, value, site_id, extension_id, environment, ${withScope ? "scope, " : ""}updated_at)
     VALUES ($1, $2, $3, $4, $5, ${withScope ? "$6, " : ""}now())`,
    [input.key, storedValue(input.key, input.value), input.site_id ?? "", input.extension_id, input.environment,
      ...(withScope ? [input.scope ?? null] : [])],
  );
  return readSetting(input);
}

/** Met à jour la valeur (et le scope s'il est modifiable). Renvoie null si le setting n'existe pas. */
export async function updateSetting(id: SettingId, patch: { value?: string; scope?: string | null }) {
  const sets: string[] = [];
  const args: unknown[] = idArgs(id);
  if (patch.value !== undefined) {
    args.push(storedValue(id.key, patch.value));
    sets.push(`value = $${args.length}`);
  }
  if (patch.scope !== undefined && (await isWritableColumn("settings", "scope"))) {
    args.push(patch.scope);
    sets.push(`scope = $${args.length}`);
  }
  const rows = await getSql().query(
    `UPDATE settings SET ${[...sets, "updated_at = now()"].join(", ")} WHERE ${ID_WHERE} RETURNING 1`,
    args,
  );
  return rows.length ? readSetting(id) : null;
}

export async function deleteSetting(id: SettingId) {
  const rows = await getSql().query(`DELETE FROM settings WHERE ${ID_WHERE} RETURNING 1`, idArgs(id));
  return rows.length > 0;
}
