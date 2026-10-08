import Link from "next/link";
import SettingsView from "@/components/SettingsView";
import { Alert, Icon } from "@/components/ui";
import { withContext } from "@/lib/context";
import { getSql, withSchema } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { getCredentials, getExtension, iconSrc, type OneStockExtension } from "@/lib/onestock";
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
  let anchors: string[] = [];
  let os: OneStockExtension | null = null;
  let rows: Setting[] = [];
  let error: string | null = null;
  try {
    const [ext] = await withSchema(() => getSql()`SELECT name, installation_point FROM extensions WHERE id = ${id}`);
    if (ext) {
      name = ext.name;
      anchors = [ext.installation_point];
    }
    // Détail OneStock (nom, points d'injection) si le site et ses identifiants API sont connus.
    if (siteId) {
      const creds = await getCredentials(siteId, search.parent_url).catch(() => null);
      if (creds) os = await getExtension(creds, siteId, id).catch(() => null);
    }
    if (os) {
      name = os.name || name;
      anchors = [...new Set((os.injection_points ?? []).map((p) => p.anchor))];
    }
    // Les settings peuvent être rangés sous l'id OneStock ou sous le slug d'un point d'injection.
    const aliases = [id, name, ...(os?.injection_points ?? []).map((p) => p.slug ?? "")].filter(Boolean);
    // Uniquement les variables du site : les variables globales (site_id vide) servent de modèle à l'installation.
    rows = await getSettings({ extensionId: aliases, siteId, siteOnly: true });
  } catch (e) {
    error = (e as Error).message;
  }

  const defaultExtensionId = rows[0]?.extension_id ?? os?.injection_points?.find((p) => p.slug)?.slug ?? id;
  const icon = iconSrc(os?.icon);

  return (
    <div className="stack">
      <div>
        <Link href={withContext("/", search)} className="back-link">
          <Icon name="chevronLeft" />
          {t("common.back")}
        </Link>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="ext-name">
            {icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="ext-icon large" />
            )}
            <div>
              <h1 className="page-title">{t("set.extTitle", { name })}</h1>
              <p className="page-subtitle chips" style={{ alignItems: "center" }}>
                <span className="tag">{id}</span>
                {anchors.map((a) => <span key={a} className="tag">{a}</span>)}
                <span>
                  {siteId ? t("set.forSiteOnly", { site: siteId }) : t("set.globalOnly")} · {t("set.count", { n: rows.length })}
                </span>
              </p>
            </div>
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
          extensionId={defaultExtensionId}
          scope="extension"
        />
      )}
    </div>
  );
}
