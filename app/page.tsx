import { ensureExtensionsTable, getSql, settingsLink, type Extension } from "@/lib/db";
import { deleteExtension, saveExtension, toggleInstalled } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExtensionsPage({
  searchParams,
}: {
  searchParams: Promise<{ point?: string; status?: string }>;
}) {
  const { point = "", status = "" } = await searchParams;

  let extensions: Extension[] = [];
  let error: string | null = null;
  try {
    await ensureExtensionsTable();
    extensions = (await getSql()`
      SELECT id, name, installation_point, installed, settings_url
      FROM extensions ORDER BY installation_point, name`) as Extension[];
  } catch (e) {
    error = (e as Error).message;
  }

  const points = [...new Set(extensions.map((e) => e.installation_point))].sort();
  const visible = extensions.filter(
    (e) =>
      (!point || e.installation_point === point) &&
      (!status || (status === "installed") === e.installed),
  );
  const installedCount = extensions.filter((e) => e.installed).length;

  return (
    <>
      <h1>Extensions du site</h1>
      <p className="sub">
        {extensions.length} extension(s) disponibles · {installedCount} installée(s)
      </p>

      {error && <p className="card error">Erreur base de données : {error}</p>}

      <div className="card">
        <form className="row" method="get">
          <select name="point" defaultValue={point}>
            <option value="">Tous les points d&apos;installation</option>
            {points.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select name="status" defaultValue={status}>
            <option value="">Tous les statuts</option>
            <option value="installed">Installées</option>
            <option value="not_installed">Non installées</option>
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
              <th>Statut</th>
              <th>Settings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((ext) => {
              const link = settingsLink(ext);
              return (
                <tr key={ext.id}>
                  <td className="mono">{ext.id}</td>
                  <td>{ext.name}</td>
                  <td className="mono">{ext.installation_point}</td>
                  <td>
                    <span className={`badge ${ext.installed ? "on" : "off"}`}>
                      {ext.installed ? "Installée" : "Non installée"}
                    </span>
                  </td>
                  <td>
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer">Table settings ↗</a>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td>
                    <div className="row">
                      <form action={toggleInstalled}>
                        <input type="hidden" name="id" value={ext.id} />
                        <button className="link" type="submit">
                          {ext.installed ? "Désinstaller" : "Installer"}
                        </button>
                      </form>
                      <form action={deleteExtension}>
                        <input type="hidden" name="id" value={ext.id} />
                        <button className="link" type="submit">Supprimer</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="sub">Aucune extension.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Ajouter / modifier une extension</h2>
        <form action={saveExtension} className="row">
          <input name="id" placeholder="ID" required />
          <input name="name" placeholder="Nom" required />
          <input name="installation_point" placeholder="Point (ex : bo.order)" required list="points" />
          <datalist id="points">
            {points.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <input name="settings_url" placeholder="Lien settings (optionnel)" type="url" />
          <label className="row">
            <input type="checkbox" name="installed" /> Installée
          </label>
          <button className="primary" type="submit">Enregistrer</button>
        </form>
        <p className="sub" style={{ margin: "8px 0 0" }}>
          Un ID existant met à jour l&apos;extension correspondante.
        </p>
      </div>
    </>
  );
}
