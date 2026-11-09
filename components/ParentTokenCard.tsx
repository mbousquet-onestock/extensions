import { saveParentTokenAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { withContext } from "@/lib/context";
import { formatDate, getT, type MessageKey } from "@/lib/i18n";
import { apiRootFor, parentOrigin } from "@/lib/onestock";
import { parentTokenStatus } from "@/lib/settings";

/**
 * Accès OneStock du parent_url du contexte : login (user_id / password → token par {{url}}/login),
 * token saisi en repli, URL de l'API et secret de signature. Les valeurs sensibles ne sont jamais renvoyées.
 */
export default async function ParentTokenCard({ params }: { params: Record<string, string | undefined> }) {
  const t = getT(params.lang);
  const origin = parentOrigin(params.parent_url);
  if (!origin) return null; // hors OneStock : pas de parent_url, rien à configurer ici
  const [status, usedRoot] = await Promise.all([
    parentTokenStatus(origin).catch(() => ({
      exists: false as const,
      apiRoot: null,
      hasSecret: false,
      login: { userId: null, hasPassword: false },
    })),
    apiRootFor(params.parent_url, params.site_id ?? "", params.api_url).catch(() => null),
  ]);
  const errorKey = params.token_error;
  const known = ["parent_url", "empty", "no_encryption_key", "api_root"];
  const loginReady = Boolean(status.login.userId && status.login.hasPassword);

  return (
    <div className="card" id="parent-token">
      <h2 className="card-title">{t("token.title")}</h2>
      <p className="secondary" style={{ margin: "0 0 12px" }}>
        {t("token.help")} <span className="tag">{origin}</span> · {t("token.apiRootUsed")}{" "}
        {usedRoot ? <span className="tag">{usedRoot}</span> : <span className="badge badge-red">{t("token.noApiRoot")}</span>}
      </p>
      {params.token_saved && <Alert type="success">{t("token.saved")}</Alert>}
      {errorKey && (
        <Alert type="danger">{known.includes(errorKey) ? t(`token.error.${errorKey}` as MessageKey) : errorKey}</Alert>
      )}

      <form action={saveParentTokenAction} className="access-form">
        <input type="hidden" name="back" value={withContext("/settings", params)} />
        <input type="hidden" name="parent_url" value={params.parent_url ?? ""} />
        <input type="hidden" name="site_id" value={params.site_id ?? ""} />

        <h3 className="section-title">{t("login.title")}</h3>
        <p className="secondary" style={{ margin: 0 }}>
          {t("login.help")}{" "}
          {loginReady ? (
            <span className="badge badge-brand">{t("login.active", { user: status.login.userId ?? "" })}</span>
          ) : (
            <span className="badge badge-grey">{t("login.inactive")}</span>
          )}
        </p>
        <div className="token-form">
          <input
            className="input"
            name="login_user_id"
            autoComplete="off"
            defaultValue={status.login.userId ?? ""}
            placeholder="user_id"
            aria-label={t("login.userId")}
            title={t("login.userId")}
          />
          <input
            className="input"
            type="password"
            name="login_password"
            autoComplete="new-password"
            placeholder={status.login.hasPassword ? t("login.passwordKeep") : t("login.password")}
            aria-label={t("login.password")}
            title={t("login.password")}
          />
          {loginReady && (
            <label className="checkbox">
              <input type="checkbox" name="clear_login" value="1" /> {t("login.clear")}
            </label>
          )}
        </div>

        <h3 className="section-title">{t("token.manual")}</h3>
        <div className="token-row">
          <div className="secret-value">
            {status.exists ? (
              <>
                <span className="mono">••••••••</span>
                <span className={`badge ${status.encrypted ? "badge-brand" : "badge-orange"}`}>
                  {status.encrypted ? t("set.encrypted") : t("set.notEncrypted")}
                </span>
                <span className="tertiary-text">{t("token.updated", { date: formatDate(status.updated_at, params) })}</span>
              </>
            ) : (
              <span className={`badge ${loginReady ? "badge-grey" : "badge-red"}`}>{t("token.missing")}</span>
            )}
          </div>
          <div className="token-form">
            <input
              className="input mono"
              type="password"
              name="token"
              autoComplete="new-password"
              placeholder={status.exists ? t("token.replace") : t("token.enter")}
              aria-label={t("token.title")}
            />
          </div>
        </div>

        <h3 className="section-title">{t("token.more")}</h3>
        <div className="token-form">
          <input
            className="input mono"
            type="url"
            name="api_root"
            defaultValue={status.apiRoot ?? ""}
            placeholder={usedRoot ?? "https://api-….onestock-retail.com"}
            aria-label={t("token.apiRoot")}
            title={t("token.apiRoot")}
          />
          <input
            className="input mono"
            type="password"
            name="extension_secret"
            autoComplete="new-password"
            placeholder={t("token.secretEnter")}
            aria-label={t("token.secret")}
            title={t("token.secret")}
          />
        </div>
        <p className="secondary" style={{ margin: 0 }}>
          {status.hasSecret ? (
            <span className="badge badge-brand">{t("token.secretSet")}</span>
          ) : (
            <span className="badge badge-orange">{t("token.secretMissing")}</span>
          )}
        </p>

        <div>
          <button className="btn btn-primary" type="submit">{t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
