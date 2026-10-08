import { HttpError, settingIdFrom, settingsRoute, valueFrom, wantsDecrypt } from "@/lib/settingsApi";
import { invalidateFromRoute, SETTINGS_TAG } from "@/lib/cache";
import { createSetting, listSettings, type SettingFilters } from "@/lib/settings";

export const dynamic = "force-dynamic";

const FILTERS = ["key", "site_id", "extension_id", "environment", "scope"] as const;

/**
 * GET /api/settings — liste filtrable : ?key=&site_id=&extension_id=&environment=&scope=&limit=
 * (site_id= vide → settings globaux). Les valeurs sensibles valent null sauf avec ?decrypt=1.
 */
export const GET = settingsRoute(async (req) => {
  const url = new URL(req.url);
  const filters: SettingFilters = {};
  for (const f of FILTERS) {
    const v = url.searchParams.get(f);
    if (v !== null) filters[f] = v;
  }
  const settings = await listSettings(filters, {
    decrypt: wantsDecrypt(url),
    limit: Number(url.searchParams.get("limit")) || 1000,
  });
  return { body: { settings, count: settings.length } };
});

/**
 * POST /api/settings — crée un setting (objet) ou plusieurs (tableau) :
 * { key, value, site_id, extension_id, environment, scope? }. 409 si le setting existe déjà.
 * Les clés sensibles (onestock_token…) sont chiffrées automatiquement.
 */
export const POST = settingsRoute(async (req, body) => {
  const url = new URL(req.url);
  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > 500) throw new HttpError(400, "expected 1 to 500 settings");

  const created = [];
  for (const item of items) {
    const id = settingIdFrom(new URL(url.origin), item);
    const value = valueFrom((item as { value?: unknown }).value);
    if (value === undefined) throw new HttpError(400, "missing_fields: value");
    const scope = (item as { scope?: string | null }).scope;
    created.push(await createSetting({ ...id, value, ...(scope !== undefined && { scope }) }));
  }
  invalidateFromRoute(SETTINGS_TAG);
  return { status: 201, body: Array.isArray(body) ? { settings: created } : { setting: created[0] } };
});
