import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import ConfirmButton from "@/components/ConfirmButton";
import HiddenContext from "@/components/HiddenContext";
import { Alert, Empty, Icon, Modal } from "@/components/ui";
import { withContext } from "@/lib/context";
import ApiExtensionDetails from "@/components/ApiExtensionDetails";
import ExtensionForm, { type ExtensionFormValues } from "@/components/ExtensionForm";
import { nameKey, readCatalog, type Extension } from "@/lib/db";
import { formatDate, getT, type MessageKey } from "@/lib/i18n";
import { getCredentials, getInstalledExtensions, iconSrc, type OneStockExtension } from "@/lib/onestock";
import { summarizeError } from "@/lib/payload";
import {
  addToCatalog,
  deleteExtension,
  installOnEnvironment,
  refreshFromOneStock,
  saveExtension,
  uninstallFromEnvironment,
} from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;
const STATUSES = ["all", "installed", "not_installed"] as const;
const DEFAULT_POINTS = ["bo.page", "bo.order.action", "bo.orders.action"];
const DONE_KEYS = ["installed", "uninstalled", "cataloged", "deleted"] as const;
const ACTION_ERRORS = ["no_credentials", "not_in_catalog", "not_found", "duplicate_name"] as const;

type Row = {
  key: string;
  name: string;
  description: string | null;
  catalog?: Extension;
  installed?: OneStockExtension;
  anchors: string[];
  diff: string[];
};

const anchorsOf = (points?: { anchor: string }[]) => [...new Set((points ?? []).map((p) => p.anchor).filter(Boolean))];
const pointsSig = (points?: { anchor: string; slug?: string; name?: string; path?: string }[]) =>
  JSON.stringify((points ?? []).map((p) => [p.anchor, p.slug ?? "", p.name ?? "", p.path ?? ""]).sort());

/** Champs du catalogue qui diffèrent de l'extension installée. */
function differences(c: Extension, os: OneStockExtension) {
  const diff: string[] = [];
  if ((c.url ?? "") !== (os.url ?? "")) diff.push("url");
  if ((c.test_url ?? "") !== (os.test_url ?? "")) diff.push("test_url");
  if (c.rank != null && os.rank != null && c.rank !== os.rank) diff.push("rank");
  if ((c.icon ?? "") !== (os.icon ?? "")) diff.push("icon");
  if (pointsSig(c.injection_points) !== pointsSig(os.injection_points)) diff.push("injection_points");
  return diff;
}

/** Champs communs aux actions de ligne : retour, site et contexte pour retrouver les identifiants API. */
function ActionFields({ params, back, name }: { params: Search; back: string; name: string }) {
  return (
    <>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="site_id" value={params.site_id ?? ""} />
      <input type="hidden" name="parent_url" value={params.parent_url ?? ""} />
    </>
  );
}

export default async function ExtensionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const t = getT(params.lang);
  const siteId = params.site_id ?? "";
  const q = (params.q ?? "").trim().toLowerCase();
  const point = params.point ?? "";
  const status = siteId && STATUSES.includes(params.status as never) ? params.status! : "all";

  let catalog: Extension[] = [];
  let error: string | null = null;
  try {
    catalog = await readCatalog();
  } catch (e) {
    error = (e as Error).message;
  }

  // Extensions installées sur le site : API OneStock (onestock_api_root + onestock_token).
  let installed: OneStockExtension[] = [];
  let apiProblem: string | null = null;
  let environment: string | null = null;
  if (siteId && !error) {
    try {
      const creds = await getCredentials(siteId, params.parent_url);
      if (!creds) apiProblem = t("ext.noCredentials", { site: siteId });
      else {
        environment = creds.environment;
        installed = await getInstalledExtensions(creds, siteId);
      }
    } catch (e) {
      apiProblem = t("ext.apiError", { error: summarizeError((e as Error).message) });
    }
  }

  // Lien catalogue ↔ installées : le nom (l'id OneStock est généré sur chaque environnement).
  const byName = new Map<string, Row>();
  for (const c of catalog) {
    byName.set(nameKey(c.name), {
      key: c.id,
      name: c.name,
      description: c.description,
      catalog: c,
      anchors: anchorsOf(c.injection_points),
      diff: [],
    });
  }
  for (const ext of installed) {
    const existing = byName.get(nameKey(ext.name));
    byName.set(existing ? nameKey(ext.name) : `os:${ext.id}`, {
      key: existing?.key ?? `os:${ext.id}`,
      name: ext.name || existing?.name || ext.id,
      description: existing?.description ?? null,
      catalog: existing?.catalog,
      installed: ext,
      anchors: anchorsOf(ext.injection_points).length ? anchorsOf(ext.injection_points) : existing?.anchors ?? [],
      diff: existing?.catalog ? differences(existing.catalog, ext) : [],
    });
  }
  const rows = new Map([...byName.values()].map((r) => [r.key, r]));
  const all = [...rows.values()].sort(
    (a, b) => Number(!!b.installed) - Number(!!a.installed) || a.name.localeCompare(b.name),
  );

  const points = [...new Set([...all.flatMap((r) => r.anchors)])].sort();
  const matching = all.filter(
    (r) =>
      (!point || r.anchors.includes(point)) &&
      (!q || [r.installed?.id ?? "", r.name, r.description ?? "", r.installed?.url ?? r.catalog?.url ?? ""].some((v) => v.toLowerCase().includes(q))),
  );
  const counts = {
    all: matching.length,
    installed: matching.filter((r) => r.installed).length,
    not_installed: matching.filter((r) => !r.installed).length,
  };
  const visible = matching.filter((r) => status === "all" || (status === "installed") === !!r.installed);

  const view: Record<string, string> = {
    ...(params.q && { q: params.q }),
    ...(point && { point }),
    ...(status !== "all" && { status }),
  };
  const { status: _status, ...withoutStatus } = view;
  const here = withContext("/", params, view);
  const editingRow = params.edit ? rows.get(params.edit) : undefined;
  const source = editingRow?.catalog ?? editingRow?.installed;
  const formValues: ExtensionFormValues = {
    id: editingRow?.catalog?.id,
    name: source?.name ?? "",
    description: editingRow?.catalog?.description ?? "",
    icon: source?.icon ?? "",
    url: source?.url ?? "",
    test_url: source?.test_url ?? "",
    rank: source?.rank != null ? String(source.rank) : "",
    injection_points: (source?.injection_points ?? []).map((p) => ({
      anchor: p.anchor,
      name: p.name ?? "",
      slug: p.slug ?? "",
      path: p.path ?? "",
      icon: p.icon ?? "",
    })),
  };
  const formError =
    params.error === "duplicate_name" || params.error === "required" ? t(`ext.${params.error}` as MessageKey) : params.error;
  const formLabels = {
    name: t("form.name"), nameHelp: t("form.nameHelp"), description: t("form.description"), icon: t("form.icon"),
    url: t("form.url"), testUrl: t("form.testUrl"), rank: t("form.rank"), rankHelp: t("form.rankHelp"), points: t("form.points"), anchor: t("form.anchor"),
    pointName: t("form.pointName"), slug: t("form.slug"), path: t("form.path"), addPoint: t("form.addPoint"),
    removePoint: t("form.removePoint"), chooseIcon: t("form.chooseIcon"), removeIcon: t("form.removeIcon"),
    iconHelp: t("form.iconHelp"), iconTooBig: t("form.iconTooBig"), noPoints: t("form.noPoints"),
    cancel: t("common.cancel"), save: t("common.save"), create: editingRow?.installed ? t("ext.addToCatalog") : t("ext.createBtn"),
  };
  const editing = !!editingRow;
  const modalOpen = params.new === "1" || editing;
  const statusLabel = { all: "ext.filterAll", installed: "ext.filterInstalled", not_installed: "ext.filterNotInstalled" } as const;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("ext.title")}</h1>
          <p className="page-subtitle">
            {siteId && environment ? t("ext.source", { site: siteId, env: environment }) : t("ext.subtitleNoSite")}
          </p>
        </div>
      </div>

      {params.saved && <Alert type="success">{t("ext.saved")}</Alert>}
      {error && <Alert type="danger">{t("common.dbError", { error })}</Alert>}
      {!siteId && <Alert type="info">{t("ext.noSite")}</Alert>}
      {apiProblem && <Alert type="danger">{apiProblem}</Alert>}
      {params.done && DONE_KEYS.includes(params.done as never) && (
        <Alert type="success">
          {t(`ext.done.${params.done}` as MessageKey, { name: params.name ?? "" })}
          {params.done === "installed" && params.copied !== undefined && (
            <> {t("ext.copiedSettings", { n: params.copied, site: siteId })}</>
          )}
        </Alert>
      )}
      {params.action_error && (
        <Alert type="danger">
          {ACTION_ERRORS.includes(params.action_error as never)
            ? t(`ext.actionError.${params.action_error}` as MessageKey, { site: siteId })
            : t("ext.apiError", { error: params.action_error })}
        </Alert>
      )}

      <div className="card flush">
        <div className="toolbar">
          <form method="get">
            <HiddenContext params={params} keep={{ status: view.status }} />
            <div className="search">
              <input className="input" name="q" defaultValue={params.q} placeholder={t("ext.searchPh")} aria-label={t("ext.searchPh")} />
              <Icon name="search" />
            </div>
            <AutoSubmitSelect name="point" defaultValue={point} aria-label={t("ext.colInjection")}>
              <option value="">{t("ext.allPoints")}</option>
              {points.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </AutoSubmitSelect>
          </form>
          {siteId && environment && (
            <form action={refreshFromOneStock}>
              <input type="hidden" name="site_id" value={siteId} />
              <input type="hidden" name="back" value={here} />
              <button type="submit" className="btn btn-secondary" title={t("ext.refreshHelp")}>
                <Icon name="refresh" />
                {t("ext.refresh")}
              </button>
            </form>
          )}
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
                <th>{t("ext.colInjection")}</th>
                <th>{t("ext.colLinks")}</th>
                {siteId && <th>{t("ext.colStatus")}</th>}
                <th className="actions-col"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const os = row.installed;
                const icon = iconSrc(os?.icon ?? row.catalog?.icon ?? undefined);
                const links = { url: os?.url ?? row.catalog?.url ?? undefined, test: os?.test_url ?? row.catalog?.test_url ?? undefined };
                return (
                  <tr key={row.key}>
                    <td>
                      <div className="ext-name">
                        {icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="ext-icon" />
                        ) : (
                          <span className="ext-icon placeholder"><Icon name="cube" /></span>
                        )}
                        <div>
                          <div className="primary-text">{row.name}</div>
                          {os && <div className="tertiary-text mono">{os.id}</div>}
                          {row.description && <div className="tertiary-text">{row.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {(os?.injection_points ?? row.catalog?.injection_points)?.length
                          ? (os?.injection_points ?? row.catalog!.injection_points).map((p, i) => (
                              <span key={`${p.anchor}-${p.slug ?? i}`} className="tag" title={[p.name, p.slug, p.path].filter(Boolean).join(" · ")}>
                                {p.anchor}
                                {p.slug && <span className="tag-sub">{p.slug}</span>}
                              </span>
                            ))
                          : row.anchors.map((a) => <span key={a} className="tag">{a}</span>)}
                      </div>
                    </td>
                    <td className="nowrap">
                      {links.url && <a href={links.url} target="_blank" rel="noreferrer" className="link-ext">{t("ext.prod")}</a>}
                      {links.test && links.test !== links.url && (
                        <a href={links.test} target="_blank" rel="noreferrer" className="link-ext">{t("ext.test")}</a>
                      )}
                      {!links.url && !links.test && <span className="secondary">—</span>}
                    </td>
                    {siteId && (
                      <td className="nowrap">
                        {os ? (
                          <>
                            <span className="badge badge-brand">{t("ext.installed")}</span>
                            {os.last_update && (
                              <div className="tertiary-text">
                                {t("ext.updatedAt", { date: formatDate(new Date(os.last_update * 1000), params) })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="badge badge-grey">{t("ext.notInstalled")}</span>
                        )}
                        {!row.catalog && <div className="tertiary-text">{t("ext.notInCatalog")}</div>}
                        {row.diff.length > 0 && (
                          <div title={t("ext.diffFields", { fields: row.diff.join(", ") })} style={{ marginTop: 4 }}>
                            <span className="badge badge-orange">{t("ext.diff")}</span>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="actions-col">
                      <div className="actions">
                        {os && (
                          <Link
                            href={withContext(`/extensions/${encodeURIComponent(os.id)}/settings`, params)}
                            className="btn btn-secondary btn-small"
                          >
                            <Icon name="settings" />
                            {t("ext.colSettings")}
                          </Link>
                        )}
                        {/* Environnement OneStock : installer une extension du catalogue */}
                        {siteId && environment && !os && row.catalog && (
                          <form action={installOnEnvironment}>
                            <ActionFields params={params} back={here} name={row.name} />
                            <input type="hidden" name="id" value={row.catalog.id} />
                            <ConfirmButton
                              className="btn btn-secondary btn-small"
                              message={t("ext.confirmInstallEnv", { name: row.name, env: environment, site: siteId })}
                              title={t("ext.installEnvTitle", { env: environment })}
                            >
                              <Icon name="download" />
                              {t("ext.install")}
                            </ConfirmButton>
                          </form>
                        )}
                        <Link
                          href={withContext("/", params, { ...view, edit: row.key })}
                          className="btn btn-icon"
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          scroll={false}
                        >
                          <Icon name="edit" />
                        </Link>
                        {/* Catalogue (base Vercel) : ajouter une extension installée / supprimer */}
                        {os && !row.catalog && (
                          <form action={addToCatalog}>
                            <ActionFields params={params} back={here} name={row.name} />
                            <input type="hidden" name="os_id" value={os.id} />
                            <button type="submit" className="btn btn-icon brand" title={t("ext.addToCatalog")} aria-label={t("ext.addToCatalog")}>
                              <Icon name="bookmark" />
                            </button>
                          </form>
                        )}
                        {row.catalog && (
                          <form action={deleteExtension}>
                            <input type="hidden" name="back" value={here} />
                            <input type="hidden" name="name" value={row.name} />
                            <input type="hidden" name="id" value={row.catalog.id} />
                            <ConfirmButton message={t("ext.confirmDelete", { name: row.name })} title={t("ext.removeCatalog")}>
                              <Icon name="trash" />
                            </ConfirmButton>
                          </form>
                        )}
                        {/* Environnement OneStock : désinstaller */}
                        {os && environment && (
                          <form action={uninstallFromEnvironment}>
                            <ActionFields params={params} back={here} name={row.name} />
                            <input type="hidden" name="os_id" value={os.id} />
                            <ConfirmButton
                              message={t("ext.confirmUninstallEnv", { name: row.name, env: environment, site: siteId })}
                              title={t("ext.uninstallEnvTitle", { env: environment })}
                            >
                              <Icon name="unplug" />
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && !error && <Empty title={all.length ? t("ext.noResults") : t("ext.none")} />}
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={editingRow ? editingRow.name : t("ext.create")}
          closeHref={here}
          closeLabel={t("common.close")}
          wide={!!editingRow?.installed}
        >
          <div className={editingRow?.installed ? "modal-columns" : undefined}>
            {editingRow?.installed && <ApiExtensionDetails ext={editingRow.installed} t={t} dateParams={params} />}
            <div>
              {(editingRow?.installed || formError) && (
                <div className="modal-body" style={{ paddingBottom: 0 }}>
                  {editingRow?.installed && <h3 className="section-title">{t("ext.catalogSection")}</h3>}
                  {formError && <Alert type="danger">{formError}</Alert>}
                  {editingRow?.installed && !editingRow.catalog && <Alert type="info">{t("ext.importHelp")}</Alert>}
                  {editingRow && editingRow.diff.length > 0 && (
                    <Alert type="neutral">{t("ext.diffFields", { fields: editingRow.diff.join(", ") })}</Alert>
                  )}
                </div>
              )}
              <ExtensionForm
                key={params.edit ?? "new"}
                action={saveExtension}
                initial={formValues}
                back={here}
                editKey={editingRow?.key}
                anchors={[...new Set([...DEFAULT_POINTS, ...points])]}
                labels={formLabels}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
