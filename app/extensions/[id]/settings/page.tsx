import Link from "next/link";
import SettingsTable from "@/components/SettingsTable";
import { withContext } from "@/lib/context";
import { ensureSchema, getSql } from "@/lib/db";
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
  const siteId = search.site_id;

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
      <p><Link href={withContext("/", search)}>← Extensions</Link></p>
      <h1>Settings de {name}</h1>
      <p className="sub">
        extension_id <span className="mono">{id}</span>
        {siteId && <> · site <span className="mono">{siteId}</span> (et tous les sites)</>}
        {" "}· {rows.length} setting(s)
      </p>
      {error && <p className="card error">Erreur base de données : {error}</p>}
      {!error && <SettingsTable rows={rows} params={search} path={`/extensions/${encodeURIComponent(id)}/settings`} />}
    </>
  );
}
