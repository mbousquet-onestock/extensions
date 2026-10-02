import SettingsTable from "@/components/SettingsTable";
import { getSettings, type Setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const search = await searchParams;
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
      <h1>Settings généraux</h1>
      <p className="sub">
        scope global
        {siteId && <> · site <span className="mono">{siteId}</span> (et tous les sites)</>}
        {" "}· {rows.length} setting(s)
      </p>
      {error && <p className="card error">Erreur base de données : {error}</p>}
      {!error && <SettingsTable rows={rows} params={search} path="/settings" showExtension />}
    </>
  );
}
