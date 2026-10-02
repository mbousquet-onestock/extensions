import Link from "next/link";
import SettingForm from "@/components/SettingForm";
import SettingsTable, { environmentsOf, findEdited } from "@/components/SettingsTable";
import { withContext } from "@/lib/context";
import { ensureSchema, getSql } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { getSettings, type Setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ExtensionSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const t = getT(search.lang);
  const siteId = search.site_id;
  const path = `/extensions/${encodeURIComponent(id)}/settings`;

  let name = id;
  let rows: Setting[] = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    const [ext] = await getSql()`SELECT name FROM extensions WHERE id = ${id}`;
    if (ext) name = ext.name;
    rows = await getSettings({ extensionId: id, siteId });
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <p><Link href={withContext("/", search)}>{t("common.back")}</Link></p>
      <h1>{t("set.extTitle", { name })}</h1>
      <p className="sub">
        extension_id <span className="mono">{id}</span>
        {siteId && <> · {t("set.forSite", { site: siteId })}</>}
        {" "}· {t("set.count", { n: rows.length })}
      </p>
      {error && <p className="card error">{t("common.dbError", { error })}</p>}
      {!error && (
        <>
          <SettingsTable rows={rows} params={search} path={path} />
          <SettingForm
            params={search}
            path={path}
            extensionId={id}
            scope="extension"
            environments={environmentsOf(rows)}
            editing={findEdited(rows, search)}
          />
        </>
      )}
    </>
  );
}
