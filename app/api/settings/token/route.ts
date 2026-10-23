import { contextApiRoot } from "@/lib/onestock";
import { HttpError, settingsRoute, valueFrom, wantsDecrypt } from "@/lib/settingsApi";
import { invalidateFromRoute, SETTINGS_TAG } from "@/lib/cache";
import { parentTokenId, readSetting, saveParentToken } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Token OneStock propre à un parent_url (ligne onestock_token dont environment = origine du parent_url).

function originFrom(url: URL) {
  const raw = url.searchParams.get("parent_url");
  if (!raw) throw new HttpError(400, "missing_fields: parent_url");
  const origin = contextApiRoot(raw);
  if (!origin) throw new HttpError(400, "invalid_parent_url: https URL of an allowed OneStock host expected");
  return origin;
}

/**
 * GET /api/settings/token?parent_url=…[&decrypt=1] — token de ce parent_url
 * (`token` vaut null sans ?decrypt=1). 404 s'il n'a pas été saisi : aucun repli sur un autre token.
 */
export const GET = settingsRoute(async (req) => {
  const url = new URL(req.url);
  const origin = originFrom(url);
  const setting = await readSetting(parentTokenId(origin), { decrypt: wantsDecrypt(url) });
  if (!setting) throw new HttpError(404, "not_found: no onestock_token for this parent_url");
  return {
    body: {
      parent_url: origin,
      api_root: origin,
      key: "onestock_token",
      token: wantsDecrypt(url) ? setting.value : null,
      encrypted: setting.encrypted,
      updated_at: setting.updated_at,
      ...("decrypt_error" in setting && { decrypt_error: setting.decrypt_error }),
    },
  };
});

/** PUT /api/settings/token?parent_url=… — enregistre (chiffré) le token de ce parent_url : { "token": "…" }. */
export const PUT = settingsRoute(async (req, body) => {
  const origin = originFrom(new URL(req.url));
  const token = valueFrom((body as { token?: unknown; value?: unknown } | undefined)?.token ?? (body as { value?: unknown } | undefined)?.value);
  if (!token) throw new HttpError(400, "missing_fields: token");
  await saveParentToken(origin, token);
  invalidateFromRoute(SETTINGS_TAG);
  return { body: { parent_url: origin, key: "onestock_token", saved: true, encrypted: true } };
});
