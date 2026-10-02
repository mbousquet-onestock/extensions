import Link from "next/link";
import { ensureSchema, getSql, type Extension } from "@/lib/db";
import { withContext } from "@/lib/context";
import { deleteExtension, installExtension, saveExtension, uninstallExtension } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

export default async function ExtensionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const siteId = params.site_id ?? "";
  const point = params.point ?? "";
  const edit = params.edit ?? "";

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
      <h1>Extensions</h1>
      <p className="sub">
        {extensions.length} extension(s) disponible(s)
        {siteId && <> · {onSite.length} installée(s) sur le site <span className="mono">{siteId}</span></>}
      </p>

      {error && <p className="card error">Erreur base de données : {error}</p>}

      <div className="section-title">
        <h2>Installées sur le site {siteId && <span className="mono">{siteId}</span>}</h2>
      </div>
      {!siteId ? (
        <p className="card sub">Aucun site_id dans le contexte : ouvrez la page depuis OneStock ou choisissez un site ci-dessus.</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Point d&apos;installation</th>
                <th>Installée le</th>
                <th>Settings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {onSite.map((ext) => (
                <tr key={ext.id}>
                  <td className="mono">{ext.id}</td>
                  <td>{ext.name}</td>
                  <td className="mono">{ext.installation_point}</td>
                  <td>{installed.get(ext.id)?.toLocaleString("fr-FR")}</td>
                  <td>
                    <Link href={withContext(`/extensions/${encodeURIComponent(ext.id)}/settings`, params)}>
                      Voir les settings
                    </Link>
                  </td>
                  <td>
                    <form action={uninstallExtension}>
                      <input type="hidden" name="id" value={ext.id} />
                      <input type="hidden" name="site_id" value={siteId} />
                      <ConfirmButton message={`Désinstaller ${ext.name} du site ${siteId} ?`}>Désinstaller</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
              {onSite.length === 0 && (
                <tr>
                  <td colSpan={6} className="sub">Aucune extension installée sur ce site.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">
        <h2>Catalogue (disponibles pour tous les sites)</h2>
        <form className="row" method="get">
          {Object.entries(params)
            .filter(([k]) => k !== "point" && k !== "edit")
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <select name="point" defaultValue={point}>
            <option value="">Tous les points d&apos;installation</option>
            {points.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit">Filtrer</button>
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Point d&apos;installation</th>
              <th>Description</th>
              {siteId && <th>Sur ce site</th>}
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
                        <span className="badge on">Installée</span>
                      ) : (
                        <form action={installExtension}>
                          <input type="hidden" name="id" value={ext.id} />
                          <input type="hidden" name="site_id" value={siteId} />
                          <button className="link" type="submit">Installer</button>
                        </form>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="row">
                      <Link href={withContext("/", params, { edit: ext.id, ...(point && { point }) }) + "#form"}>
                        Modifier
                      </Link>
                      <form action={deleteExtension}>
                        <input type="hidden" name="id" value={ext.id} />
                        <ConfirmButton message={`Supprimer ${ext.name} du catalogue (et de tous les sites) ?`}>
                          Supprimer
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {catalog.length === 0 && !error && (
              <tr>
                <td colSpan={siteId ? 6 : 5} className="sub">Aucune extension.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" id="form">
        <h2>{editing ? `Modifier ${editing.name}` : "Créer une extension"}</h2>
        <form action={saveExtension} className="row" key={editing?.id ?? "new"}>
          <input type="hidden" name="back" value={here} />
          <input
            name="id"
            placeholder="ID"
            required
            defaultValue={editing?.id}
            readOnly={!!editing}
          />
          <input name="name" placeholder="Nom" required defaultValue={editing?.name} />
          <input
            name="installation_point"
            placeholder="Point (ex : bo.order.action)"
            required
            list="points"
            defaultValue={editing?.installation_point}
          />
          <datalist id="points">
            {[...new Set(["bo.page", "bo.order.action", "bo.orders.action", ...points])].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <input name="description" placeholder="Description" defaultValue={editing?.description ?? ""} size={40} />
          <button className="primary" type="submit">{editing ? "Enregistrer" : "Créer"}</button>
          {editing && <Link href={here}>Annuler</Link>}
        </form>
      </div>
    </>
  );
}
