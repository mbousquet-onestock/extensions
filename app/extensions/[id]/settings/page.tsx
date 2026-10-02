import Link from "next/link";
import SettingsView from "@/components/SettingsView";
import { Alert, Icon } from "@/components/ui";
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

  let name = id;
  let point: string | null = null;
  let rows: Setting[] = [];
  let error: string | null = null;
  try {
    await ensureSchema();
    const [ext] = await getSql()`SELECT name, installation_point FROM extensions WHERE id = ${id}`;
    if (ext) {
      name = ext.name;
      point = ext.installation_point;
    }
    rows = await getSettings({ extensionId: id, siteId });
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="stack">
      <div>
        <Link href={withContext("/", search)} className="back-link">
          <Icon name="chevronLeft" />
          {t("common.back")}
        </Link>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">{t("set.extTitle", { name })}</h1>
            <p className="page-subtitle">
              <span className="tag">{id}</span>
              {point && <> <span className="tag">{point}</span></>}
              {" "}{siteId ? t("set.forSite", { site: siteId }) : ""} · {t("set.count", { n: rows.length })}
            </p>
          </div>
        </div>
      </div>
      {error ? (
        <Alert type="danger">{t("common.dbError", { error })}</Alert>
      ) : (
        <SettingsView
          rows={rows}
          params={search}
          path={`/extensions/${encodeURIComponent(id)}/settings`}
          extensionId={id}
          scope="extension"
        />
      )}
    </div>
  );
}
