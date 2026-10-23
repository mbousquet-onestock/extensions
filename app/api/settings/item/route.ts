import { apiRootFor, parentOrigin } from "@/lib/onestock";
import { HttpError, settingIdFrom, settingsRoute, valueFrom, wantsDecrypt } from "@/lib/settingsApi";
import { invalidateFromRoute, SETTINGS_TAG } from "@/lib/cache";
import { createSetting, deleteSetting, parentTokenId, readSetting, updateSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Un setting est identifié par key + site_id (vide = global) + extension_id + environment,
// passés en query (?key=…&site_id=…&extension_id=…&environment=…) ou dans le corps JSON.

/** GET /api/settings/item — lit un setting (valeur sensible déchiffrée avec ?decrypt=1). */
export const GET = settingsRoute(async (req) => {
  const url = new URL(req.url);
  // onestock_token + ?parent_url= : uniquement le token de ce parent_url (404 s'il n'est pas saisi) ;
  // site_id / extension_id / environment sont alors inutiles.
  const origin = parentOrigin(url.searchParams.get("parent_url"));
  if (origin && url.searchParams.get("key") === "onestock_token") {
    const perParent = await readSetting(parentTokenId(origin), { decrypt: wantsDecrypt(url) });
    if (!perParent) throw new HttpError(404, "not_found: no onestock_token for this parent_url");
    return { body: { setting: { ...perParent, from_context: true } } };
  }
  // onestock_api_root + ?parent_url= : URL de l'API utilisée pour ce parent_url (la sienne, sinon celle de l'environnement).
  if (origin && url.searchParams.get("key") === "onestock_api_root") {
    const value = await apiRootFor(origin, url.searchParams.get("site_id") ?? "");
    if (!value) throw new HttpError(404, "not_found: no onestock_api_root for this parent_url");
    return { body: { setting: { key: "onestock_api_root", value, parent_url: origin, from_context: true } } };
  }
  const setting = await readSetting(settingIdFrom(url), { decrypt: wantsDecrypt(url) });
  if (!setting) throw new HttpError(404, "not_found");
  return { body: { setting } };
});

/**
 * PUT /api/settings/item — met à jour { value?, scope? }. 404 si absent,
 * sauf avec ?upsert=1 qui le crée (value obligatoire).
 */
export const PUT = settingsRoute(async (req, body) => {
  const url = new URL(req.url);
  const id = settingIdFrom(url, body);
  const b = (body ?? {}) as { value?: unknown; scope?: string | null };
  const value = valueFrom(b.value);
  if (value === undefined && b.scope === undefined) throw new HttpError(400, "nothing_to_update: value or scope expected");

  const updated = await updateSetting(id, { value, ...(b.scope !== undefined && { scope: b.scope }) });
  if (updated) {
    invalidateFromRoute(SETTINGS_TAG);
    return { body: { setting: updated } };
  }

  if (["1", "true"].includes(url.searchParams.get("upsert") ?? "")) {
    if (value === undefined) throw new HttpError(400, "missing_fields: value");
    invalidateFromRoute(SETTINGS_TAG);
    return { status: 201, body: { setting: await createSetting({ ...id, value, ...(b.scope !== undefined && { scope: b.scope }) }) } };
  }
  throw new HttpError(404, "not_found");
});

/** DELETE /api/settings/item — supprime un setting. */
export const DELETE = settingsRoute(async (req) => {
  const deleted = await deleteSetting(settingIdFrom(new URL(req.url)));
  if (!deleted) throw new HttpError(404, "not_found");
  invalidateFromRoute(SETTINGS_TAG);
  return { body: { deleted: true } };
});
