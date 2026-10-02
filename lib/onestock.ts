import http from "node:http";
import https from "node:https";
import { logApiCall } from "@/lib/apiLogs";
import { getSql } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

// ---------- Identifiants (table settings) ----------

export type Credentials = { apiRoot: string; token: string; environment: string };

/**
 * Lit `onestock_api_root` et `onestock_token` dans settings pour le site (une valeur propre au site
 * l'emporte sur `*`). Environnement : ONESTOCK_ENVIRONMENT, sinon déduit du contexte (« qualif » dans
 * l'URL parente), sinon le seul disponible, sinon prod.
 */
export async function getCredentials(siteId: string, hint?: string | null): Promise<Credentials | null> {
  const rows = (await getSql()`
    SELECT key, value, site_id, environment FROM settings
    WHERE key IN ('onestock_api_root', 'onestock_token')
      AND (site_id = ${siteId} OR site_id IS NULL OR site_id IN ('*', ''))
      AND (extension_id IS NULL OR extension_id IN ('*', '') OR scope = 'global')`) as {
    key: string;
    value: string;
    site_id: string | null;
    environment: string;
  }[];
  if (rows.length === 0) return null;

  const envs = [...new Set(rows.map((r) => r.environment))];
  const wanted = process.env.ONESTOCK_ENVIRONMENT || (hint && /qualif/i.test(hint) ? "qualif" : undefined);
  const environment =
    (wanted && envs.find((e) => e === wanted)) ||
    (envs.length === 1 ? envs[0] : envs.find((e) => /^prod/i.test(e)) ?? envs[0]);

  const pick = (key: string) => {
    const candidates = rows.filter((r) => r.key === key && r.environment === environment);
    return (candidates.find((r) => r.site_id === siteId) ?? candidates[0])?.value;
  };
  const apiRoot = pick("onestock_api_root");
  // Le token est stocké chiffré : il n'est déchiffré qu'ici, côté serveur, pour l'appel à l'API.
  const stored = pick("onestock_token");
  const token = stored ? decryptSecret(stored) : undefined;
  return apiRoot && token ? { apiRoot, token, environment } : null;
}

/** {{url}} = onestock_api_root (une version, ex. `v3`, peut être ajoutée via ONESTOCK_API_VERSION). */
export function apiBase(apiRoot: string) {
  const root = apiRoot.replace(/\/+$/, "");
  const version = process.env.ONESTOCK_API_VERSION?.replace(/^\/+|\/+$/g, "");
  return version ? `${root}/${version}` : root;
}

// ---------- Appel HTTP (JSON, y compris un corps sur GET) ----------

export class OneStockError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

function requestJson(method: string, url: string, body: unknown, timeoutMs = 15000) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = (u.protocol === "http:" ? http : https).request(
      u,
      {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "content-length": Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end(payload);
  });
}

/** Remplace les images base64 (icônes) par un libellé court pour le journal. */
function stripImages(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        typeof v === "string" && v.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(v) ? `[base64, ${v.length} chars]` : stripImages(v),
      ]),
    );
  }
  return value;
}

/** Appelle l'API OneStock avec `{ site_id, token }` et journalise l'appel dans api_logs. */
export async function callOneStock<T>(creds: Credentials, siteId: string, method: "GET" | "POST", path: string) {
  const url = `${apiBase(creds.apiRoot)}${path}`;
  const body = { site_id: siteId, token: creds.token };
  const started = Date.now();
  let status: number | null = null;
  let parsed: unknown = undefined;
  let error: string | null = null;

  try {
    const res = await requestJson(method, url, body);
    status = res.status;
    try {
      parsed = res.text ? JSON.parse(res.text) : null;
    } catch {
      parsed = res.text;
    }
    if (status >= 400) error = `OneStock API answered HTTP ${status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`;
  } catch (e) {
    error = `OneStock API unreachable: ${(e as Error).message}`;
  }

  await logApiCall({
    siteId,
    api: "OneStock",
    method,
    path: url,
    status,
    durationMs: Date.now() - started,
    request: { site_id: siteId, token: creds.token },
    response: error ? null : stripImages(parsed),
    error,
    result: error ? null : summarize(parsed),
  }).catch(() => {});

  if (error) throw new OneStockError(error, status);
  return parsed as T;
}

function summarize(v: unknown) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const [k, val] = Object.entries(v)[0] ?? [];
    if (Array.isArray(val)) return `${val.length} ${k}`;
    if (val && typeof val === "object" && "name" in val) return String((val as { name: unknown }).name);
  }
  return "OK";
}

// ---------- Extensions ----------

export type InjectionPoint = { anchor: string; name?: string; path?: string; slug?: string; icon?: string };

export type OneStockExtension = {
  id: string;
  name: string;
  icon?: string;
  url?: string;
  test_url?: string;
  creation_date?: number;
  last_update?: number;
  injection_points?: InjectionPoint[];
};

/** Extensions installées sur le site : `POST /extensions/query`, puis `GET /extensions/{id}` pour chacune. */
export async function getInstalledExtensions(creds: Credentials, siteId: string) {
  const list = await callOneStock<{ extensions?: { id: string }[] }>(creds, siteId, "POST", "/extensions/query");
  const ids = (list?.extensions ?? []).map((e) => e.id).filter(Boolean);
  const details = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await callOneStock<{ extension: OneStockExtension }>(
          creds,
          siteId,
          "GET",
          `/extensions/${encodeURIComponent(id)}`,
        );
        return res?.extension ? { ...res.extension, id: res.extension.id || id } : { id, name: id };
      } catch {
        return { id, name: id } as OneStockExtension;
      }
    }),
  );
  return details;
}

export async function getExtension(creds: Credentials, siteId: string, id: string) {
  const res = await callOneStock<{ extension: OneStockExtension }>(creds, siteId, "GET", `/extensions/${encodeURIComponent(id)}`);
  return res?.extension ?? null;
}

/** Image d'une icône renvoyée en base64 (JPEG par défaut, PNG/GIF/SVG reconnus). */
export function iconSrc(icon?: string) {
  if (!icon) return null;
  if (icon.startsWith("data:") || icon.startsWith("http")) return icon;
  const type = icon.startsWith("iVBOR") ? "png" : icon.startsWith("R0lGOD") ? "gif" : icon.startsWith("PHN2") ? "svg+xml" : "jpeg";
  return `data:image/${type};base64,${icon}`;
}
