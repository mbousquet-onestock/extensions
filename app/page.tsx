import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import ConfirmButton from "@/components/ConfirmButton";
import HiddenContext from "@/components/HiddenContext";
import { Alert, Empty, Icon, Modal } from "@/components/ui";
import { withContext } from "@/lib/context";
import { ensureSchema, getSql, type Extension } from "@/lib/db";
import { formatDate, getT } from "@/lib/i18n";
import { deleteExtension, installExtension, saveExtension, uninstallExtension } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;
const STATUSES = ["all", "installed", "not_installed"] as const;
const DEFAULT_POINTS = ["bo.page", "bo.order.action", "bo.orders.action"];

export default async function ExtensionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const t = getT(params.lang);
  const siteId = params.site_id ?? "";
  const q = (params.q ?? "").trim().toLowerCase();
  const point = params.point ?? "";
  const status = siteId && STATUSES.includes(params.status as never) ? params.status! : "all";

  let extensions: Extension[] = [];
  let installed = new Map<string, Date>();
  let error: string | null = null;
  try {
    await ensureSchema();
    const sql = getSql();
    const [exts, inst] = await Promise.all([
      sql`SELECT id, name, installation_point, description FROM extensions ORDER BY name`,
      siteId
        ? sql`SELECT extension_id, installed_at FROM site_extensions WHERE site_id = ${siteId}`
        : Promise.resolve([]),
    ]);
    extensions = exts as Extension[];
    installed = new Map(inst.map((r) => [r.extension_id as string, r.installed_at as Date]));
  } catch (e) {
    error = (e as Error).message;
  }

  const points = [...new Set(extensions.map((e) => e.installation_point))].sort();
  const matching = extensions.filter(
    (e) =>
      (!point || e.installation_point === point) &&
      (!q || [e.id, e.name, e.description ?? ""].some((v) => v.toLowerCase().includes(q))),
  );
  const counts = {
    all: matching.length,
    installed: matching.filter((e) => installed.has(e.id)).length,
    not_installed: matching.filter((e) => !installed.has(e.id)).length,
  };
  const visible = matching.filter(
    (e) => status === "all" || (status === "installed") === installed.has(e.id),
  );

  // Paramètres de la vue courante, conservés par les liens et formulaires.
  const view: Record<string, string> = {
    ...(params.q && { q: params.q }),
    ...(point && { point }),
    ...(status !== "all" && { status }),
  };
  const { status: _status, ...withoutStatus } = view;
  const here = withContext("/", params, view);
  const editing = params.edit ? extensions.find((e) => e.id === params.edit) : undefined;
  const modalOpen = params.new === "1" || !!editing;
  const statusLabel = { all: "ext.filterAll", installed: "ext.filterInstalled", not_installed: "ext.filterNotInstalled" } as const;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("ext.title")}</h1>
          <p className="page-subtitle">
            {siteId ? t("ext.subtitleSite", { site: siteId }) : t("ext.subtitleNoSite")}
          </p>
        </div>
      </div>

      {params.saved && <Alert type="success">{t("ext.saved")}</Alert>}
      {error && <Alert type="danger">{t("common.dbError", { error })}</Alert>}
      {!siteId && <Alert type="info">{t("ext.noSite")}</Alert>}

      <div className="card flush">
        <div className="toolbar">
          <form method="get">
            <HiddenContext params={params} keep={{ status: view.status }} />
            <div className="search">
              <input className="input" name="q" defaultValue={params.q} placeholder={t("ext.searchPh")} aria-label={t("ext.searchPh")} />
              <Icon name="search" />
            </div>
            <AutoSubmitSelect name="point" defaultValue={point} aria-label={t("ext.colPoint")}>
              <option value="">{t("ext.allPoints")}</option>
              {points.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </AutoSubmitSelect>
          </form>
          <Link href={withContext("/", params, { ...view, new: "1" })} className="btn btn-primary" scroll={false}>
            <Icon name="plus" />
            {t("ext.createBtn")}
          </Link>
        </div>

        {siteId && (
          <div className="subbar">
            <nav className="tabs small">
              {STATUSES.map((s) => (
                <Link
                  key={s}
                  href={withContext("/", params, { ...withoutStatus, ...(s !== "all" && { status: s }) })}
                  className={`tab${status === s ? " active" : ""}`}
                >
                  {t(statusLabel[s])}
                  <span className="count">{counts[s]}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("ext.colName")}</th>
                <th>{t("ext.colPoint")}</th>
                <th>{t("ext.colDescription")}</th>
                {siteId && <th>{t("ext.colStatus")}</th>}
                <th className="actions-col"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ext) => {
                const installedAt = installed.get(ext.id);
                return (
                  <tr key={ext.id}>
                    <td>
                      <div className="primary-text">{ext.name}</div>
                      <div className="tertiary-text mono">{ext.id}</div>
                    </td>
                    <td><span className="tag">{ext.installation_point}</span></td>
                    <td className="cell secondary">{ext.description || "—"}</td>
                    {siteId && (
                      <td className="nowrap">
                        {installedAt ? (
                          <>
                            <span className="badge badge-brand">{t("ext.installed")}</span>
                            <div className="tertiary-text">{formatDate(installedAt, params)}</div>
                          </>
                        ) : (
                          <span className="badge badge-grey">{t("ext.notInstalled")}</span>
                        )}
                      </td>
                    )}
                    <td className="actions-col">
                      <div className="actions">
                        {siteId && installedAt && (
                          <Link
                            href={withContext(`/extensions/${encodeURIComponent(ext.id)}/settings`, params)}
                            className="btn btn-secondary btn-small"
                          >
                            <Icon name="settings" />
                            {t("ext.colSettings")}
                          </Link>
                        )}
                        {siteId && !installedAt && (
                          <form action={installExtension}>
                            <input type="hidden" name="id" value={ext.id} />
                            <input type="hidden" name="site_id" value={siteId} />
                            <button className="btn btn-secondary btn-small" type="submit">
                              <Icon name="download" />
                              {t("ext.install")}
                            </button>
                          </form>
                        )}
                        <Link
                          href={withContext("/", params, { ...view, edit: ext.id })}
                          className="btn btn-icon"
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          scroll={false}
                        >
                          <Icon name="edit" />
                        </Link>
                        {siteId && installedAt && (
                          <form action={uninstallExtension}>
                            <input type="hidden" name="id" value={ext.id} />
                            <input type="hidden" name="site_id" value={siteId} />
                            <ConfirmButton
                              message={t("ext.confirmUninstall", { name: ext.name, site: siteId })}
                              title={t("ext.uninstall")}
                            >
                              <Icon name="remove" />
                            </ConfirmButton>
                          </form>
                        )}
                        <form action={deleteExtension}>
                          <input type="hidden" name="id" value={ext.id} />
                          <ConfirmButton message={t("ext.confirmDelete", { name: ext.name })} title={t("common.delete")}>
                            <Icon name="trash" />
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && !error && (
            <Empty title={extensions.length ? t("ext.noResults") : t("ext.none")} />
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={editing ? t("ext.editTitle", { name: editing.name }) : t("ext.create")}
          closeHref={here}
          closeLabel={t("common.close")}
        >
          <form action={saveExtension}>
            <input type="hidden" name="back" value={here} />
            <div className="modal-body">
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">{t("ext.colId")}</span>
                  <input className="input mono" name="id" required defaultValue={editing?.id} readOnly={!!editing} autoFocus={!editing} />
                  <span className="field-help">{t("ext.idHelp")}</span>
                </label>
                <label className="field">
                  <span className="field-label">{t("ext.colName")}</span>
                  <input className="input" name="name" required defaultValue={editing?.name} autoFocus={!!editing} />
                </label>
                <label className="field full">
                  <span className="field-label">{t("ext.colPoint")}</span>
                  <input
                    className="input mono"
                    name="installation_point"
                    required
                    list="points"
                    placeholder="bo.order.action"
                    defaultValue={editing?.installation_point}
                  />
                  <datalist id="points">
                    {[...new Set([...DEFAULT_POINTS, ...points])].map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </label>
                <label className="field full">
                  <span className="field-label">{t("ext.colDescription")}</span>
                  <textarea className="textarea" style={{ fontFamily: "inherit" }} name="description" rows={3} defaultValue={editing?.description ?? ""} />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <Link href={here} className="btn btn-secondary" scroll={false}>{t("common.cancel")}</Link>
              <button className="btn btn-primary" type="submit">{editing ? t("common.save") : t("ext.createBtn")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
