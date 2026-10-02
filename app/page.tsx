import Link from "next/link";
import { ensureSchema, getSql, type Extension } from "@/lib/db";
import { withContext } from "@/lib/context";
import { deleteExtension, installExtension, saveExtension, uninstallExtension } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";
import { formatDate, getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

export default async function ExtensionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const siteId = params.site_id ?? "";
  const point = params.point ?? "";
  const edit = params.edit ?? "";
  const t = getT(params.lang);

  let extensions: Extension[] = [];
  let installed = new Map<string, Date>();
  let error: string | null = null;
  try {
    await ensureSchema();
    const sql = getSql();
    const [exts, inst] = await Promise.all([
      sql`SELECT id, name, installation_point, description FROM extensions ORDER BY installation_point, name`,
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
  const catalog = extensions.filter((e) => !point || e.installation_point === point);
  const onSite = extensions.filter((e) => installed.has(e.id));
  const editing = extensions.find((e) => e.id === edit);
  const here = withContext("/", params, point ? { point } : {});

  return (
    <>
      <h1>{t("ext.title")}</h1>
      <p className="sub">
        {t("ext.available", { n: extensions.length })}
        {siteId && <> · {t("ext.installedOn", { n: onSite.length })} <span className="mono">{siteId}</span></>}
      </p>

      {error && <p className="card error">{t("common.dbError", { error })}</p>}

      <div className="section-title">
        <h2>{t("ext.installedSection")} {siteId && <span className="mono">{siteId}</span>}</h2>
      </div>
      {!siteId ? (
        <p className="card sub">{t("ext.noSite")}</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("ext.colId")}</th>
                <th>{t("ext.colName")}</th>
                <th>{t("ext.colPoint")}</th>
                <th>{t("ext.colInstalledAt")}</th>
                <th>{t("ext.colSettings")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {onSite.map((ext) => (
                <tr key={ext.id}>
                  <td className="mono">{ext.id}</td>
                  <td>{ext.name}</td>
                  <td className="mono">{ext.installation_point}</td>
                  <td>{formatDate(installed.get(ext.id), params)}</td>
                  <td>
                    <Link href={withContext(`/extensions/${encodeURIComponent(ext.id)}/settings`, params)}>
                      {t("ext.viewSettings")}
                    </Link>
                  </td>
                  <td>
                    <form action={uninstallExtension}>
                      <input type="hidden" name="id" value={ext.id} />
                      <input type="hidden" name="site_id" value={siteId} />
                      <ConfirmButton message={t("ext.confirmUninstall", { name: ext.name, site: siteId })}>
                        {t("ext.uninstall")}
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
              {onSite.length === 0 && (
                <tr>
                  <td colSpan={6} className="sub">{t("ext.noneInstalled")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">
        <h2>{t("ext.catalog")}</h2>
        <form className="row" method="get">
          {Object.entries(params)
            .filter(([k]) => k !== "point" && k !== "edit")
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <select name="point" defaultValue={point}>
            <option value="">{t("ext.allPoints")}</option>
            {points.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit">{t("common.filter")}</button>
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("ext.colId")}</th>
              <th>{t("ext.colName")}</th>
              <th>{t("ext.colPoint")}</th>
              <th>{t("ext.colDescription")}</th>
              {siteId && <th>{t("ext.colOnSite")}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((ext) => {
              const isInstalled = installed.has(ext.id);
              return (
                <tr key={ext.id}>
                  <td className="mono">{ext.id}</td>
                  <td>{ext.name}</td>
                  <td className="mono">{ext.installation_point}</td>
                  <td className="cell">{ext.description ?? <span className="sub">—</span>}</td>
                  {siteId && (
                    <td>
                      {isInstalled ? (
                        <span className="badge on">{t("ext.installed")}</span>
                      ) : (
                        <form action={installExtension}>
                          <input type="hidden" name="id" value={ext.id} />
                          <input type="hidden" name="site_id" value={siteId} />
                          <button className="link" type="submit">{t("ext.install")}</button>
                        </form>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="row">
                      <Link href={withContext("/", params, { edit: ext.id, ...(point && { point }) }) + "#form"}>
                        {t("common.edit")}
                      </Link>
                      <form action={deleteExtension}>
                        <input type="hidden" name="id" value={ext.id} />
                        <ConfirmButton message={t("ext.confirmDelete", { name: ext.name })}>
                          {t("common.delete")}
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {catalog.length === 0 && !error && (
              <tr>
                <td colSpan={siteId ? 6 : 5} className="sub">{t("ext.none")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" id="form">
        <h2>{editing ? t("ext.editTitle", { name: editing.name }) : t("ext.create")}</h2>
        <form action={saveExtension} className="row" key={editing?.id ?? "new"}>
          <input type="hidden" name="back" value={here} />
          <input
            name="id"
            placeholder={t("ext.phId")}
            required
            defaultValue={editing?.id}
            readOnly={!!editing}
          />
          <input name="name" placeholder={t("ext.phName")} required defaultValue={editing?.name} />
          <input
            name="installation_point"
            placeholder={t("ext.phPoint")}
            required
            list="points"
            defaultValue={editing?.installation_point}
          />
          <datalist id="points">
            {[...new Set(["bo.page", "bo.order.action", "bo.orders.action", ...points])].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <input name="description" placeholder={t("ext.phDescription")} defaultValue={editing?.description ?? ""} size={40} />
          <button className="primary" type="submit">{editing ? t("common.save") : t("ext.createBtn")}</button>
          {editing && <Link href={here}>{t("common.cancel")}</Link>}
        </form>
      </div>
    </>
  );
}
