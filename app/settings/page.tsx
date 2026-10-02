import DataTable from "@/components/DataTable";
import MissingTable from "@/components/MissingTable";
import { GENERAL_SETTINGS_TABLE, readTable, SETTINGS_TABLE, tableColumns } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { site_id: siteId } = await searchParams;

  let table = GENERAL_SETTINGS_TABLE;
  let note: string | null = null;
  let result: Awaited<ReturnType<typeof readTable>> | null = null;
  let error: string | null = null;
  try {
    if ((await tableColumns(GENERAL_SETTINGS_TABLE)).length > 0) {
      result = await readTable(GENERAL_SETTINGS_TABLE, { site_id: siteId });
    } else {
      // Pas de table dédiée : settings sans extension dans la table settings.
      table = SETTINGS_TABLE;
      result = await readTable(SETTINGS_TABLE, { extension_id: null, site_id: siteId });
      if (result.exists) note = `Lignes de ${SETTINGS_TABLE} sans extension_id (aucune table ${GENERAL_SETTINGS_TABLE}).`;
    }
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h1>Settings généraux</h1>
      <p className="sub">
        Table <span className="mono">{table}</span>
        {siteId && result?.applied.includes("site_id") && <> · site <span className="mono">{siteId}</span></>}
        {result?.exists && <> · {result.rows.length} ligne(s)</>}
      </p>
      {note && <p className="sub">{note}</p>}

      {error && <p className="card error">Erreur base de données : {error}</p>}
      {result && !result.exists && <MissingTable table={GENERAL_SETTINGS_TABLE} envVar="GENERAL_SETTINGS_TABLE" />}
      {result?.exists && <DataTable columns={result.columns} rows={result.rows} empty="Aucun setting." />}
    </>
  );
}
