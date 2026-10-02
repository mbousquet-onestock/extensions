import { listTables } from "@/lib/db";

export default async function MissingTable({ table, envVar }: { table: string; envVar: string }) {
  const tables = await listTables().catch(() => [] as string[]);
  return (
    <div className="card">
      <p className="error" style={{ marginTop: 0 }}>
        La table <span className="mono">{table}</span> n&apos;existe pas dans la base.
      </p>
      <p className="sub">
        Indiquez la bonne table avec la variable d&apos;environnement <span className="mono">{envVar}</span>.
        Tables présentes : {tables.length ? <span className="mono">{tables.join(", ")}</span> : "aucune"}.
      </p>
    </div>
  );
}
