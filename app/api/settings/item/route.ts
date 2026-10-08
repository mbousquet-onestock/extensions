import { HttpError, settingIdFrom, settingsRoute, valueFrom, wantsDecrypt } from "@/lib/settingsApi";
import { createSetting, deleteSetting, readSetting, updateSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Un setting est identifié par key + site_id (vide = global) + extension_id + environment,
// passés en query (?key=…&site_id=…&extension_id=…&environment=…) ou dans le corps JSON.

/** GET /api/settings/item — lit un setting (valeur sensible déchiffrée avec ?decrypt=1). */
export const GET = settingsRoute(async (req) => {
  const url = new URL(req.url);
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
  if (updated) return { body: { setting: updated } };

  if (["1", "true"].includes(url.searchParams.get("upsert") ?? "")) {
    if (value === undefined) throw new HttpError(400, "missing_fields: value");
    return { status: 201, body: { setting: await createSetting({ ...id, value, ...(b.scope !== undefined && { scope: b.scope }) }) } };
  }
  throw new HttpError(404, "not_found");
});

/** DELETE /api/settings/item — supprime un setting. */
export const DELETE = settingsRoute(async (req) => {
  const deleted = await deleteSetting(settingIdFrom(new URL(req.url)));
  if (!deleted) throw new HttpError(404, "not_found");
  return { body: { deleted: true } };
});
