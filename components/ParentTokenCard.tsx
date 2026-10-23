import { saveParentTokenAction } from "@/app/actions";
import { Alert } from "@/components/ui";
import { withContext } from "@/lib/context";
import { formatDate, getT, type MessageKey } from "@/lib/i18n";
import { contextApiRoot } from "@/lib/onestock";
import { parentTokenStatus } from "@/lib/settings";

/** Token OneStock du parent_url du contexte : état (jamais la valeur) et saisie, stocké chiffré. */
export default async function ParentTokenCard({ params }: { params: Record<string, string | undefined> }) {
  const t = getT(params.lang);
  const origin = contextApiRoot(params.parent_url);
  if (!origin) return null; // hors OneStock : pas de parent_url, rien à configurer ici
  const status = await parentTokenStatus(origin).catch(() => ({ exists: false as const }));
  const errorKey = params.token_error;
  const known = ["parent_url", "empty", "no_encryption_key"];

  return (
    <div className="card" id="parent-token">
      <h2 className="card-title">{t("token.title")}</h2>
      <p className="secondary" style={{ margin: "0 0 12px" }}>
        {t("token.help")} <span className="tag">{origin}</span>
      </p>
      {params.token_saved && <Alert type="success">{t("token.saved")}</Alert>}
      {errorKey && (
        <Alert type="danger">{known.includes(errorKey) ? t(`token.error.${errorKey}` as MessageKey) : errorKey}</Alert>
      )}
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
            <span className="badge badge-red">{t("token.missing")}</span>
          )}
        </div>
        <form action={saveParentTokenAction} className="token-form">
          <input type="hidden" name="back" value={withContext("/settings", params)} />
          <input type="hidden" name="parent_url" value={params.parent_url ?? ""} />
          <input type="hidden" name="site_id" value={params.site_id ?? ""} />
          <input
            className="input mono"
            type="password"
            name="token"
            autoComplete="new-password"
            required
            placeholder={status.exists ? t("token.replace") : t("token.enter")}
            aria-label={t("token.title")}
          />
          <button className="btn btn-primary" type="submit">{t("common.save")}</button>
        </form>
      </div>
    </div>
  );
}
