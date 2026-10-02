import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import ConfirmButton from "@/components/ConfirmButton";
import HiddenContext from "@/components/HiddenContext";
import { Alert, Empty, Icon, Modal } from "@/components/ui";
import { withContext } from "@/lib/context";
import { ensureSchema, getSql, type Extension } from "@/lib/db";
import { formatDate, getT } from "@/lib/i18n";
import { getCredentials, getInstalledExtensions, iconSrc, type OneStockExtension } from "@/lib/onestock";
import { summarizeError } from "@/lib/payload";
import { deleteExtension, saveExtension } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;
const STATUSES = ["all", "installed", "not_installed"] as const;
const DEFAULT_POINTS = ["bo.page", "bo.order.action", "bo.orders.action"];

type Row = {
  id: string;
  name: string;
  description: string | null;
  catalog?: Extension;
  installed?: OneStockExtension;
  anchors: string[];
};

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
    await ensureSchema();
    catalog = (await getSql()`
      SELECT id, name, installation_point, description FROM extensions ORDER BY name`) as Extension[];
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

  const rows = new Map<string, Row>();
  for (const c of catalog) {
    rows.set(c.id, { id: c.id, name: c.name, description: c.description, catalog: c, anchors: [c.installation_point] });
  }
  for (const ext of installed) {
    const anchors = [...new Set((ext.injection_points ?? []).map((p) => p.anchor).filter(Boolean))];
    const existing = rows.get(ext.id);
    rows.set(ext.id, {
      id: ext.id,
      name: ext.name || existing?.name || ext.id,
      description: existing?.description ?? null,
      catalog: existing?.catalog,
      installed: ext,
      anchors: anchors.length ? anchors : existing?.anchors ?? [],
    });
  }
  const all = [...rows.values()].sort(
    (a, b) => Number(!!b.installed) - Number(!!a.installed) || a.name.localeCompare(b.name),
  );

  const points = [...new Set([...all.flatMap((r) => r.anchors)])].sort();
  const matching = all.filter(
    (r) =>
      (!point || r.anchors.includes(point)) &&
      (!q || [r.id, r.name, r.description ?? "", r.installed?.url ?? ""].some((v) => v.toLowerCase().includes(q))),
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
  const editing = editingRow && {
    id: editingRow.id,
    name: editingRow.name,
    installation_point: editingRow.catalog?.installation_point ?? editingRow.anchors[0] ?? "",
    description: editingRow.description,
    exists: !!editingRow.catalog,
  };
  const modalOpen = params.new === "1" || !!editing;
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
                const icon = iconSrc(os?.icon);
                return (
                  <tr key={row.id}>
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
                          <div className="tertiary-text mono">{row.id}</div>
                          {row.description && <div className="tertiary-text">{row.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {os?.injection_points?.length
                          ? os.injection_points.map((p, i) => (
                              <span key={`${p.anchor}-${p.slug ?? i}`} className="tag" title={[p.name, p.slug, p.path].filter(Boolean).join(" · ")}>
                                {p.anchor}
                                {p.slug && <span className="tag-sub">{p.slug}</span>}
                              </span>
                            ))
                          : row.anchors.map((a) => <span key={a} className="tag">{a}</span>)}
                      </div>
                    </td>
                    <td className="nowrap">
                      {os?.url && <a href={os.url} target="_blank" rel="noreferrer" className="link-ext">{t("ext.prod")}</a>}
                      {os?.test_url && os.test_url !== os.url && (
                        <a href={os.test_url} target="_blank" rel="noreferrer" className="link-ext">{t("ext.test")}</a>
                      )}
                      {!os?.url && !os?.test_url && <span className="secondary">—</span>}
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
                      </td>
                    )}
                    <td className="actions-col">
                      <div className="actions">
                        {os && (
                          <Link
                            href={withContext(`/extensions/${encodeURIComponent(row.id)}/settings`, params)}
                            className="btn btn-secondary btn-small"
                          >
                            <Icon name="settings" />
                            {t("ext.colSettings")}
                          </Link>
                        )}
                        <Link
                          href={withContext("/", params, { ...view, edit: row.id })}
                          className="btn btn-icon"
                          title={t("common.edit")}
                          aria-label={t("common.edit")}
                          scroll={false}
                        >
                          <Icon name="edit" />
                        </Link>
                        {row.catalog && (
                          <form action={deleteExtension}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmButton message={t("ext.confirmDelete", { name: row.name })} title={t("common.delete")}>
                              <Icon name="trash" />
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
              <button className="btn btn-primary" type="submit">{editing?.exists ? t("common.save") : t("ext.createBtn")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
