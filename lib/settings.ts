import { getSql } from "@/lib/db";
import { isEncrypted, isSecretKey } from "@/lib/secrets";

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
export async function getSettings({ extensionId, siteId }: { extensionId?: string | string[]; siteId?: string }) {
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
    where.push(`(site_id = $${args.length} OR site_id IS NULL OR site_id IN ('*', ''))`);
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
