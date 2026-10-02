import SettingForm from "@/components/SettingForm";
import SettingsTable, { environmentsOf, findEdited } from "@/components/SettingsTable";
import { getT } from "@/lib/i18n";
import { getSettings, type Setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const search = await searchParams;
  const t = getT(search.lang);
  const siteId = search.site_id;

  let rows: Setting[] = [];
  let error: string | null = null;
  try {
    rows = await getSettings({ siteId });
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h1>{t("set.generalTitle")}</h1>
      <p className="sub">
        {t("set.scopeGlobal")}
        {siteId && <> · {t("set.forSite", { site: siteId })}</>}
        {" "}· {t("set.count", { n: rows.length })}
      </p>
      {error && <p className="card error">{t("common.dbError", { error })}</p>}
      {!error && (
        <>
          <SettingsTable rows={rows} params={search} path="/settings" showExtension />
          <SettingForm
            params={search}
            path="/settings"
            extensionId="*"
            scope="global"
            environments={environmentsOf(rows)}
            editing={findEdited(rows, search)}
          />
        </>
      )}
    </>
  );
}
