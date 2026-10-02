import Link from "next/link";
import { withContext } from "@/lib/context";
import { isOverridden, isWildcard, type Setting } from "@/lib/settings";

const SENSITIVE = /token|secret|password|passwd|key$|api_key|credential/i;

function Value({ row }: { row: Setting }) {
  const value = row.value ?? "";
  if (SENSITIVE.test(row.key) && value) {
    return (
      <details>
        <summary>••••••••</summary>
        <pre className="mono">{value}</pre>
      </details>
    );
  }
  if (value.length > 80) {
    return (
      <details>
        <summary>{value.slice(0, 50)}…</summary>
        <pre className="mono">{value}</pre>
      </details>
    );
  }
  return <>{value}</>;
}

export default function SettingsTable({
  rows,
  params,
  path,
  showExtension,
}: {
  rows: Setting[];
  params: Record<string, string | undefined>;
  path: string;
  showExtension?: boolean;
}) {
  const environments = [...new Set(rows.map((r) => r.environment))].sort();
  const env = params.env && environments.includes(params.env) ? params.env : "";
  const visible = env ? rows.filter((r) => r.environment === env) : rows;

  return (
    <>
      {environments.length > 1 && (
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="sub">Environnement :</span>
          <Link href={withContext(path, params)} className={!env ? "active" : undefined}>Tous</Link>
          {environments.map((e) => (
            <Link key={e} href={withContext(path, params, { env: e })} className={env === e ? "active" : undefined}>
              {e}
            </Link>
          ))}
        </div>
      )}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Clé</th>
              <th>Valeur</th>
              <th>Site</th>
              {showExtension && <th>Extension</th>}
              <th>Environnement</th>
              <th>Scope</th>
              <th>Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const overridden = isOverridden(row, visible);
              return (
                <tr key={`${row.key}|${row.site_id}|${row.extension_id}|${row.environment}`} className={overridden ? "muted" : undefined}>
                  <td className="mono">{row.key}</td>
                  <td className="cell mono"><Value row={row} /></td>
                  <td className="mono">
                    {isWildcard(row.site_id) ? <span className="badge off">tous les sites</span> : row.site_id}
                    {overridden && <> <span className="badge off">remplacé</span></>}
                  </td>
                  {showExtension && (
                    <td className="mono">{isWildcard(row.extension_id) ? <span className="badge off">toutes</span> : row.extension_id}</td>
                  )}
                  <td className="mono">{row.environment}</td>
                  <td className="mono">{row.scope ?? <span className="sub">—</span>}</td>
                  <td>{row.updated_at instanceof Date ? row.updated_at.toLocaleString("fr-FR") : String(row.updated_at)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={showExtension ? 7 : 6} className="sub">Aucun setting.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
