import { checkApiKey } from "@/lib/apiAuth";
import { logApiCallLater } from "@/lib/apiLogs";
import { MissingKeyError, isSecretKey } from "@/lib/secrets";
import type { SettingId } from "@/lib/settings";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Masque la valeur des settings sensibles (champ `value`) avant journalisation. */
function sanitize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const secret = (typeof o.key === "string" && isSecretKey(o.key)) || o.secret === true;
    return Object.fromEntries(
      Object.entries(o).map(([k, val]) => [k, k === "value" && secret && val != null ? "••••••••" : sanitize(val)]),
    );
  }
  return v;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Enveloppe commune des routes /api/settings : clé d'API, erreurs JSON homogènes
 * et journalisation de l'appel dans api_logs (« Settings API »).
 */
export function settingsRoute(handler: (req: Request, body: unknown) => Promise<{ status?: number; body: unknown }>) {
  return async (req: Request) => {
    const started = Date.now();
    const url = new URL(req.url);
    let body: unknown = undefined;
    let status = 500;
    let payload: unknown;

    const auth = checkApiKey(req);
    if (!auth.ok) {
      status = auth.status;
      payload = { error: auth.error };
    } else {
      try {
        if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
          const text = await req.text();
          try {
            body = text ? JSON.parse(text) : {};
          } catch {
            throw new HttpError(400, "invalid_json");
          }
        }
        const res = await handler(req, body);
        status = res.status ?? 200;
        payload = res.body;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (e instanceof HttpError) [status, payload] = [e.status, { error: e.message }];
        else if (e instanceof MissingKeyError) [status, payload] = [500, { error: "encryption_key_missing: SETTINGS_ENCRYPTION_KEY is not set" }];
        else if (code === "23505") [status, payload] = [409, { error: "already_exists" }];
        else [status, payload] = [500, { error: (e as Error).message }];
      }
    }

    logApiCallLater({
      siteId: url.searchParams.get("site_id") ?? (body as { site_id?: string })?.site_id ?? undefined,
      api: "Settings API",
      method: req.method,
      path: url.pathname + url.search,
      status,
      durationMs: Date.now() - started,
      request: body === undefined ? null : sanitize(body),
      response: status >= 400 ? null : sanitize(payload),
      error: status >= 400 ? (payload as { error: string }).error : null,
      result: status < 400 ? summary(payload) : null,
    });

    return status === 204 ? new Response(null, { status }) : json(status, payload);
  };
}

function summary(payload: unknown) {
  const p = payload as { settings?: unknown[]; setting?: { key: string }; deleted?: boolean };
  if (Array.isArray(p?.settings)) return `${p.settings.length} setting(s)`;
  if (p?.setting) return p.setting.key;
  if (p?.deleted) return "deleted";
  return "OK";
}

// ---------- Lecture / validation des paramètres ----------

const ID_FIELDS = ["key", "site_id", "extension_id", "environment"] as const;

/** Identifiant depuis la requête (query) puis le corps ; site_id vide autorisé (= global). */
export function settingIdFrom(url: URL, body?: unknown): SettingId {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const get = (f: (typeof ID_FIELDS)[number]) => url.searchParams.get(f) ?? (b[f] == null ? null : String(b[f]));
  const id = { key: get("key"), site_id: get("site_id") ?? "", extension_id: get("extension_id"), environment: get("environment") };
  const missing = ID_FIELDS.filter((f) => f !== "site_id" && !id[f]);
  if (missing.length) throw new HttpError(400, `missing_fields: ${missing.join(", ")}`);
  return id as SettingId;
}

/** Valeur d'un setting : chaîne ; nombres et booléens convertis, objets sérialisés en JSON. */
export function valueFrom(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) throw new HttpError(400, "invalid_value: null");
  return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
}

export const wantsDecrypt = (url: URL) => ["1", "true"].includes(url.searchParams.get("decrypt") ?? "");
