import Link from "next/link";
import { saveSetting } from "@/app/actions";
import { withContext } from "@/lib/context";
import { getT, type MessageKey } from "@/lib/i18n";
import type { Setting } from "@/lib/settings";

/**
 * Formulaire d'ajout / modification d'un setting.
 * En modification, les colonnes de la clé primaire (key, site_id, extension_id, environment) sont figées.
 */
export default function SettingForm({
  params,
  path,
  extensionId,
  scope,
  environments,
  editing,
}: {
  params: Record<string, string | undefined>;
  path: string;
  extensionId: string;
  scope: string;
  environments: string[];
  editing?: Setting;
}) {
  const t = getT(params.lang);
  const siteId = params.site_id ?? "";
  const keep: Record<string, string> = params.env ? { env: params.env } : {};
  const back = withContext(path, params, keep);
  const errorKey = params.error === "required" || params.error === "duplicate" ? (`set.${params.error}` as MessageKey) : null;

  return (
    <div className="card" id="setting-form">
      <h2>{editing ? t("set.editTitle", { key: editing.key }) : t("set.add")}</h2>
      {params.saved && <p className="notice">{t("set.saved")}</p>}
      {params.error && <p className="error">{errorKey ? t(errorKey) : t("common.dbError", { error: params.error })}</p>}

      <form action={saveSetting} className="row" key={editing ? `${editing.key}|${editing.site_id}|${editing.environment}` : "new"}>
        <input type="hidden" name="back" value={back} />
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
        <input name="key" placeholder={t("set.colKey")} required defaultValue={editing?.key} readOnly={!!editing} />
        <input
          name="site_id"
          placeholder={t("set.phSite")}
          required={!editing}
          defaultValue={editing ? editing.site_id : siteId || "*"}
          readOnly={!!editing}
          list="setting-sites"
        />
        <datalist id="setting-sites">
          {[...new Set([siteId, "*"].filter(Boolean))].map((s) => <option key={s} value={s} />)}
        </datalist>
        <input
          name="environment"
          placeholder={t("set.phEnvironment")}
          required
          defaultValue={editing?.environment ?? params.env ?? environments[0] ?? ""}
          readOnly={!!editing}
          list="setting-envs"
        />
        <datalist id="setting-envs">
          {environments.map((e) => <option key={e} value={e} />)}
        </datalist>
        <textarea name="value" placeholder={t("set.colValue")} defaultValue={editing?.value} rows={1} cols={40} />
        <button className="primary" type="submit">{editing ? t("common.save") : t("ext.createBtn")}</button>
        {editing && <Link href={back}>{t("common.cancel")}</Link>}
      </form>
    </div>
  );
}
