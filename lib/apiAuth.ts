import { timingSafeEqual } from "node:crypto";

/**
 * Authentification de l'API settings : `Authorization: Bearer <clé>` (ou en-tête `x-api-key`).
 * Clés acceptées : SETTINGS_API_KEYS (séparées par des virgules). Sans clé configurée, l'API est désactivée.
 */
export function checkApiKey(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const keys = (process.env.SETTINGS_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return { ok: false, status: 503, error: "api_disabled: SETTINGS_API_KEYS is not set" };

  const header = req.headers.get("authorization") ?? "";
  const given = (header.match(/^Bearer\s+(.+)$/i)?.[1] ?? req.headers.get("x-api-key") ?? "").trim();
  if (!given) return { ok: false, status: 401, error: "unauthorized: missing API key" };

  const g = Buffer.from(given);
  const valid = keys.some((k) => {
    const b = Buffer.from(k);
    return b.length === g.length && timingSafeEqual(b, g);
  });
  return valid ? { ok: true } : { ok: false, status: 401, error: "unauthorized: invalid API key" };
}
