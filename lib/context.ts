// Paramètres d'URL transmis par OneStock au chargement de l'iframe d'une extension.
export const CONTEXT_KEYS = [
  "site_id",
  "extension_id",
  "user_id",
  "lang",
  "timezone",
  "locale",
  "parent_url",
  "host_app",
  "injection_point_path",
] as const;

type Params = Record<string, string | string[] | undefined>;

export function contextParams(params: Params) {
  const out = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value) out.set(key, value);
  }
  return out;
}

/** Construit un lien interne qui conserve le contexte OneStock. */
export function withContext(path: string, params: Params | URLSearchParams, extra: Record<string, string> = {}) {
  const ctx =
    params instanceof URLSearchParams
      ? contextParams(Object.fromEntries(params))
      : contextParams(params);
  for (const [k, v] of Object.entries(extra)) ctx.set(k, v);
  const qs = ctx.toString();
  return qs ? `${path}?${qs}` : path;
}
