import Link from "next/link";
import DataTable from "@/components/DataTable";
import MissingTable from "@/components/MissingTable";
import { withContext } from "@/lib/context";
import { ensureSchema, getSql, readTable, SETTINGS_TABLE } from "@/lib/db";

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
  let result: Awaited<ReturnType<typeof readTable>> | null = null;
  let error: string | null = null;
  try {
    await ensureSchema();
    const [ext] = await getSql()`SELECT name FROM extensions WHERE id = ${id}`;
    if (ext) name = ext.name;
    result = await readTable(SETTINGS_TABLE, { extension_id: id, site_id: siteId });
  } catch (e) {
    error = (e as Error).message;
  }

  const missingFilter = result?.exists && !result.applied.includes("extension_id");

  return (
    <>
      <p><Link href={withContext("/", search)}>← Extensions</Link></p>
      <h1>Settings de {name}</h1>
      <p className="sub">
        Table <span className="mono">{SETTINGS_TABLE}</span> · extension <span className="mono">{id}</span>
        {siteId && <> · site <span className="mono">{siteId}</span></>}
        {result?.exists && <> · {result.rows.length} ligne(s)</>}
      </p>

      {error && <p className="card error">Erreur base de données : {error}</p>}
      {result && !result.exists && <MissingTable table={SETTINGS_TABLE} envVar="SETTINGS_TABLE" />}
      {missingFilter && (
        <p className="card error">
          La table {SETTINGS_TABLE} n&apos;a pas de colonne extension_id : toutes ses lignes sont affichées.
        </p>
      )}
      {result?.exists && (
        <DataTable columns={result.columns} rows={result.rows} empty="Aucun setting pour cette extension." />
      )}
    </>
  );
}
