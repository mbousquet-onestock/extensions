import Link from "next/link";
import { withContext } from "@/lib/context";
import { formatDate, getT } from "@/lib/i18n";
import { isOverridden, isWildcard, type Setting } from "@/lib/settings";

const SENSITIVE = /token|secret|password|passwd|api_key|credential/i;

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

export function settingEditParams(row: Setting) {
  return { edit_key: row.key, edit_site: row.site_id ?? "", edit_ext: row.extension_id, edit_env: row.environment };
}

export function findEdited(rows: Setting[], params: Record<string, string | undefined>) {
  if (params.edit_key === undefined) return undefined;
  return rows.find(
    (r) =>
      r.key === params.edit_key &&
      (r.site_id ?? "") === (params.edit_site ?? "") &&
      r.extension_id === params.edit_ext &&
      r.environment === params.edit_env,
  );
}

export function environmentsOf(rows: Setting[]) {
  return [...new Set(rows.map((r) => r.environment))].sort();
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
  const t = getT(params.lang);
  const environments = environmentsOf(rows);
  const env = params.env && environments.includes(params.env) ? params.env : "";
  const visible = env ? rows.filter((r) => r.environment === env) : rows;
  const keep: Record<string, string> = env ? { env } : {};

  return (
    <>
      {environments.length > 1 && (
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="sub">{t("set.environment")}</span>
          <Link href={withContext(path, params)} className={!env ? "active" : undefined}>{t("set.all")}</Link>
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
              <th>{t("set.colKey")}</th>
              <th>{t("set.colValue")}</th>
              <th>{t("set.colSite")}</th>
              {showExtension && <th>{t("set.colExtension")}</th>}
              <th>{t("set.colEnvironment")}</th>
              <th>{t("set.colScope")}</th>
              <th>{t("set.colUpdated")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const overridden = isOverridden(row, visible);
              return (
                <tr
                  key={`${row.key}|${row.site_id}|${row.extension_id}|${row.environment}`}
                  className={overridden ? "muted" : undefined}
                >
                  <td className="mono">{row.key}</td>
                  <td className="cell mono"><Value row={row} /></td>
                  <td className="mono">
                    {isWildcard(row.site_id) ? <span className="badge off">{t("set.allSites")}</span> : row.site_id}
                    {overridden && <> <span className="badge off">{t("set.overridden")}</span></>}
                  </td>
                  {showExtension && (
                    <td className="mono">
                      {isWildcard(row.extension_id) ? <span className="badge off">{t("set.allExtensions")}</span> : row.extension_id}
                    </td>
                  )}
                  <td className="mono">{row.environment}</td>
                  <td className="mono">{row.scope ?? <span className="sub">—</span>}</td>
                  <td>{formatDate(row.updated_at, params)}</td>
                  <td>
                    <Link href={withContext(path, params, { ...keep, ...settingEditParams(row) }) + "#setting-form"}>
                      {t("common.edit")}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={showExtension ? 8 : 7} className="sub">{t("set.none")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
