import SettingsView from "@/components/SettingsView";
import { Alert } from "@/components/ui";
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
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("set.generalTitle")}</h1>
          <p className="page-subtitle">
            {t("set.scopeGlobal")}
            {siteId && <> · {t("set.forSite", { site: siteId })}</>} · {t("set.count", { n: rows.length })}
          </p>
        </div>
      </div>
      {error ? (
        <Alert type="danger">{t("common.dbError", { error })}</Alert>
      ) : (
        <SettingsView rows={rows} params={search} path="/settings" extensionId="*" scope="global" showExtension />
      )}
    </div>
  );
}
