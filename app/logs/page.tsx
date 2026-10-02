import { getSql } from "@/lib/db";
import PurgeForm from "./PurgeForm";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [50, 100, 500];

function formatValue(value: unknown) {
  if (value === null || value === undefined) return <span className="sub">—</span>;
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  if (typeof value === "object") {
    const json = JSON.stringify(value, null, 2);
    return (
      <details>
        <summary>JSON</summary>
        <pre className="mono">{json}</pre>
      </details>
    );
  }
  const str = String(value);
  if (str.length > 120) {
    return (
      <details>
        <summary>{str.slice(0, 60)}…</summary>
        <pre className="mono">{str}</pre>
      </details>
    );
  }
  return str;
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string; purged?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : PAGE_SIZES[0];
  const page = Math.max(1, Number(params.page) || 1);

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const sql = getSql();
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'api_logs' AND table_schema = current_schema()
      ORDER BY ordinal_position`;
    columns = cols.map((c) => c.column_name as string);
    if (columns.length === 0) throw new Error("La table api_logs n'existe pas (lancer npm run db:migrate).");

    const orderBy = columns.includes("created_at")
      ? "created_at DESC"
      : columns.includes("id")
        ? "id DESC"
        : "1";
    const where = q ? "WHERE l::text ILIKE $1" : "";
    const args = q ? [`%${q}%`] : [];

    const [countRes, data] = await Promise.all([
      sql.query(`SELECT count(*)::int AS n FROM api_logs l ${where}`, args),
      sql.query(
        `SELECT * FROM api_logs l ${where} ORDER BY ${orderBy} LIMIT ${size} OFFSET ${(page - 1) * size}`,
        args,
      ),
    ]);
    total = (countRes as { n: number }[])[0].n;
    rows = data as Record<string, unknown>[];
  } catch (e) {
    error = (e as Error).message;
  }

  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) =>
    `/logs?${new URLSearchParams({ ...(q && { q }), size: String(size), page: String(p) })}`;

  return (
    <>
      <h1>Appels API</h1>
      <p className="sub">{total} entrée(s) dans api_logs</p>

      {params.purged !== undefined && (
        <p className="card notice">{params.purged} log(s) supprimé(s).</p>
      )}
      {error && <p className="card error">Erreur base de données : {error}</p>}

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <form className="row" method="get">
          <input name="q" placeholder="Rechercher (url, statut, contenu…)" defaultValue={q} size={32} />
          <select name="size" defaultValue={String(size)}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
          <button type="submit">Rechercher</button>
        </form>
        {!error && <PurgeForm canFilterByDate={columns.includes("created_at")} />}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={String(row.id ?? i)}>
                {columns.map((c) => (
                  <td key={c} className="cell mono">{formatValue(row[c])}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={Math.max(1, columns.length)} className="sub">Aucun log.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="row">
          {page > 1 && <a href={href(page - 1)}>← Précédent</a>}
          <span className="sub">Page {page} / {pages}</span>
          {page < pages && <a href={href(page + 1)}>Suivant →</a>}
        </div>
      )}
    </>
  );
}
