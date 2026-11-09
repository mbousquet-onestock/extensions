import { apiRootFor, getCredentials, OneStockError, parentOrigin } from "@/lib/onestock";
import { HttpError, settingsRoute, valueFrom, wantsDecrypt } from "@/lib/settingsApi";
import { invalidateFromRoute, SETTINGS_TAG } from "@/lib/cache";
import { parentTokenId, parentTokenStatus, readSetting, saveParentApiRoot, saveParentLogin, saveParentToken } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Token OneStock propre à un parent_url (ligne onestock_token dont environment = origine du parent_url).

function originFrom(url: URL) {
  const raw = url.searchParams.get("parent_url");
  if (!raw) throw new HttpError(400, "missing_fields: parent_url");
  const origin = parentOrigin(raw);
  if (!origin) throw new HttpError(400, "invalid_parent_url: https URL of an allowed OneStock host expected");
  return origin;
}

/**
 * GET /api/settings/token?parent_url=…[&site_id=…][&api_url=…][&decrypt=1] — token de ce parent_url
 * (`token` vaut null sans ?decrypt=1). Si un login (user_id / password) est configuré pour ce parent_url,
 * le token est obtenu par {{url}}/login pour site_id (obligatoire) ; sinon c'est le token saisi.
 * 404 si aucun des deux : aucun repli sur un autre token.
 */
export const GET = settingsRoute(async (req) => {
  const url = new URL(req.url);
  const origin = originFrom(url);
  const siteId = url.searchParams.get("site_id") ?? "";
  const status = await parentTokenStatus(origin);
  if (status.login.userId && status.login.hasPassword) {
    if (!siteId) throw new HttpError(400, "missing_fields: site_id (required to log in)");
    let creds;
    try {
      creds = await getCredentials(siteId, origin, url.searchParams.get("api_url"));
    } catch (e) {
      const status = (e as OneStockError).status;
      throw new HttpError(status === 401 || status === 403 ? 401 : 502, `login_failed: ${(e as Error).message}`);
    }
    if (!creds) throw new HttpError(404, "not_found: no api_root for this parent_url (send api_url)");
    return {
      body: {
        parent_url: origin,
        api_root: creds.apiRoot,
        key: "onestock_token",
        token: wantsDecrypt(url) ? creds.token : null,
        token_source: "login",
        user_id: status.login.userId,
      },
    };
  }
  const setting = await readSetting(parentTokenId(origin), { decrypt: wantsDecrypt(url) });
  if (!setting) throw new HttpError(404, "not_found: no onestock_token for this parent_url");
  return {
    body: {
      parent_url: origin,
      api_root: await apiRootFor(origin, url.searchParams.get("site_id") ?? "", url.searchParams.get("api_url")),
      key: "onestock_token",
      token: wantsDecrypt(url) ? setting.value : null,
      token_source: "setting",
      encrypted: setting.encrypted,
      updated_at: setting.updated_at,
      ...("decrypt_error" in setting && { decrypt_error: setting.decrypt_error }),
    },
  };
});

/**
 * PUT /api/settings/token?parent_url=… — enregistre le token (chiffré) et/ou l'URL de l'API de ce parent_url :
 * { "token": "…", "api_root": "https://api-….onestock-retail.com", "user_id": "…", "password": "…" }
 * (user_id / password : login pour obtenir le token par {{url}}/login ; password chiffré).
 */
export const PUT = settingsRoute(async (req, body) => {
  const origin = originFrom(new URL(req.url));
  const b = (body ?? {}) as { token?: unknown; value?: unknown; api_root?: unknown; user_id?: unknown; password?: unknown };
  const token = valueFrom(b.token ?? b.value);
  const apiRoot = valueFrom(b.api_root)?.replace(/\/+$/, "");
  const userId = valueFrom(b.user_id);
  const password = valueFrom(b.password);
  if (!token && !apiRoot && !userId && !password) throw new HttpError(400, "missing_fields: token, api_root, user_id or password");
  if (apiRoot && !parentOrigin(apiRoot)) throw new HttpError(400, "invalid_api_root: https URL of an allowed OneStock host expected");
  if (apiRoot) await saveParentApiRoot(origin, apiRoot);
  if (token) await saveParentToken(origin, token);
  if (userId || password) await saveParentLogin(origin, { userId, password });
  invalidateFromRoute(SETTINGS_TAG);
  return {
    body: {
      parent_url: origin,
      api_root: apiRoot ?? (await apiRootFor(origin)),
      token_saved: Boolean(token),
      login_saved: Boolean(userId || password),
      encrypted: true,
    },
  };
});
