import Link from "next/link";
import { saveSetting } from "@/app/actions";
import HiddenContext from "@/components/HiddenContext";
import { Alert, Empty, Icon, Modal } from "@/components/ui";
import { withContext } from "@/lib/context";
import { formatDate, getT, type MessageKey } from "@/lib/i18n";
import { isOverridden, isWildcard, type Setting } from "@/lib/settings";

const SENSITIVE = /token|secret|password|passwd|api_key|credential/i;

function Value({ row }: { row: Setting }) {
  const value = row.value ?? "";
  if (SENSITIVE.test(row.key) && value) {
    return (
      <details className="reveal">
        <summary>••••••••</summary>
        <pre className="code">{value}</pre>
      </details>
    );
  }
  if (value.length > 80) {
    return (
      <details className="reveal">
        <summary>{value.slice(0, 50)}…</summary>
        <pre className="code">{value}</pre>
      </details>
    );
  }
  return <span className="mono">{value}</span>;
}

const rowId = (r: Setting) => `${r.key}|${r.site_id ?? ""}|${r.extension_id}|${r.environment}`;

/**
 * Liste des settings (recherche, filtre par environnement) + modale d'ajout / modification.
 * En modification, les colonnes de la clé primaire (key, site_id, extension_id, environment) sont figées.
 */
export default function SettingsView({
  rows,
  params,
  path,
  extensionId,
  scope,
  showExtension,
}: {
  rows: Setting[];
  params: Record<string, string | undefined>;
  path: string;
  extensionId: string;
  scope: string;
  showExtension?: boolean;
}) {
  const t = getT(params.lang);
  const siteId = params.site_id ?? "";
  const environments = [...new Set(rows.map((r) => r.environment))].sort();
  const env = params.env && environments.includes(params.env) ? params.env : "";
  const q = (params.q ?? "").trim().toLowerCase();
  const visible = rows.filter(
    (r) => (!env || r.environment === env) && (!q || `${r.key} ${r.value}`.toLowerCase().includes(q)),
  );

  const view: Record<string, string> = { ...(env && { env }), ...(params.q && { q: params.q }) };
  const { env: _env, ...withoutEnv } = view;
  const here = withContext(path, params, view);

  const editing =
    params.edit_key !== undefined
      ? rows.find(
          (r) =>
            r.key === params.edit_key &&
            (r.site_id ?? "") === (params.edit_site ?? "") &&
            r.extension_id === params.edit_ext &&
            r.environment === params.edit_env,
        )
      : undefined;
  const modalOpen = params.new === "1" || !!editing;
  const errorKey =
    params.error === "required" || params.error === "duplicate" ? (`set.${params.error}` as MessageKey) : null;

  return (
    <>
      {params.saved && <Alert type="success">{t("set.saved")}</Alert>}
      {params.error && !modalOpen && (
        <Alert type="danger">{errorKey ? t(errorKey) : t("common.dbError", { error: params.error })}</Alert>
      )}

      <div className="card flush">
        <div className="toolbar">
          <form method="get">
            <HiddenContext params={params} keep={{ env }} />
            <div className="search">
              <input className="input" name="q" defaultValue={params.q} placeholder={t("set.searchPh")} aria-label={t("set.searchPh")} />
              <Icon name="search" />
            </div>
          </form>
          <Link href={withContext(path, params, { ...view, new: "1" })} className="btn btn-primary" scroll={false}>
            <Icon name="plus" />
            {t("set.addBtn")}
          </Link>
        </div>

        {environments.length > 1 && (
          <div className="subbar">
            <nav className="tabs small" aria-label={t("set.colEnvironment")}>
              <Link href={withContext(path, params, withoutEnv)} className={`tab${!env ? " active" : ""}`}>
                {t("set.all")}
                <span className="count">{rows.length}</span>
              </Link>
              {environments.map((e) => (
                <Link key={e} href={withContext(path, params, { ...withoutEnv, env: e })} className={`tab${env === e ? " active" : ""}`}>
                  {e}
                  <span className="count">{rows.filter((r) => r.environment === e).length}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("set.colKey")}</th>
                <th>{t("set.colValue")}</th>
                <th>{t("set.colSite")}</th>
                {showExtension && <th>{t("set.colExtension")}</th>}
                <th>{t("set.colEnvironment")}</th>
                <th>{t("set.colUpdated")}</th>
                <th className="actions-col"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const overridden = isOverridden(row, visible);
                return (
                  <tr key={rowId(row)} className={overridden ? "muted" : undefined}>
                    <td>
                      <div className="primary-text mono">{row.key}</div>
                      {row.scope && <div className="tertiary-text">{row.scope}</div>}
                    </td>
                    <td className="cell"><Value row={row} /></td>
                    <td className="nowrap">
                      {isWildcard(row.site_id) ? (
                        <span className="badge badge-grey">{t("set.allSites")}</span>
                      ) : (
                        <span className="tag">{row.site_id}</span>
                      )}
                      {overridden && <> <span className="badge badge-orange">{t("set.overridden")}</span></>}
                    </td>
                    {showExtension && (
                      <td className="nowrap">
                        {isWildcard(row.extension_id) ? (
                          <span className="badge badge-grey">{t("set.allExtensions")}</span>
                        ) : (
                          <span className="tag">{row.extension_id}</span>
                        )}
                      </td>
                    )}
                    <td><span className="badge badge-blue">{row.environment}</span></td>
                    <td className="nowrap secondary">{formatDate(row.updated_at, params)}</td>
                    <td className="actions-col">
                      <div className="actions">
                        <Link
                          href={withContext(path, params, {
                            ...view,
                            edit_key: row.key,
                            edit_site: row.site_id ?? "",
                            edit_ext: row.extension_id,
                            edit_env: row.environment,
                          })}
                          className="btn btn-icon"
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          scroll={false}
                        >
                          <Icon name="edit" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <Empty title={rows.length ? t("set.noResults") : t("set.none")} />}
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={editing ? t("set.editTitle", { key: editing.key }) : t("set.add")}
          closeHref={here}
          closeLabel={t("common.close")}
        >
          <form action={saveSetting} key={editing ? rowId(editing) : "new"}>
            <input type="hidden" name="back" value={here} />
            <input type="hidden" name="extension_id" value={editing?.extension_id ?? extensionId} />
            <input type="hidden" name="scope" value={editing?.scope ?? scope} />
            {editing && (
              <input
                type="hidden"
                name="original"
                value={JSON.stringify({
                  key: editing.key,
                  site_id: editing.site_id ?? "",
                  extension_id: editing.extension_id,
                  environment: editing.environment,
                })}
              />
            )}
            <div className="modal-body">
              {params.error && (
                <Alert type="danger">{errorKey ? t(errorKey) : t("common.dbError", { error: params.error })}</Alert>
              )}
              {editing && <Alert type="neutral">{t("set.lockedHelp")}</Alert>}
              <div className="form-grid">
                <label className="field full">
                  <span className="field-label">{t("set.colKey")}</span>
                  <input className="input mono" name="key" required defaultValue={editing?.key} readOnly={!!editing} autoFocus={!editing} />
                </label>
                <label className="field">
                  <span className="field-label">{t("set.colSite")}</span>
                  <input
                    className="input mono"
                    name="site_id"
                    required={!editing}
                    defaultValue={editing ? editing.site_id : siteId || "*"}
                    readOnly={!!editing}
                    list="setting-sites"
                  />
                  <datalist id="setting-sites">
                    {[...new Set([siteId, "*"].filter(Boolean))].map((s) => <option key={s} value={s} />)}
                  </datalist>
                  {!editing && <span className="field-help">{t("set.siteHelp")}</span>}
                </label>
                <label className="field">
                  <span className="field-label">{t("set.colEnvironment")}</span>
                  <input
                    className="input mono"
                    name="environment"
                    required
                    defaultValue={editing?.environment ?? env ?? environments[0] ?? ""}
                    readOnly={!!editing}
                    list="setting-envs"
                  />
                  <datalist id="setting-envs">
                    {environments.map((e) => <option key={e} value={e} />)}
                  </datalist>
                </label>
                <label className="field full">
                  <span className="field-label">{t("set.colValue")}</span>
                  <textarea className="textarea" name="value" rows={4} defaultValue={editing?.value} autoFocus={!!editing} />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <Link href={here} className="btn btn-secondary" scroll={false}>{t("common.cancel")}</Link>
              <button className="btn btn-primary" type="submit">{editing ? t("common.save") : t("set.addBtn")}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
