import DataTable from "@/components/DataTable";
import { contextParams, withContext } from "@/lib/context";
import { getSql, tableColumns, type Row } from "@/lib/db";
import { getT } from "@/lib/i18n";
import PurgeForm from "./PurgeForm";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [50, 100, 500];

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const t = getT(params.lang);
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : PAGE_SIZES[0];
  const page = Math.max(1, Number(params.page) || 1);

  let columns: string[] = [];
  let rows: Row[] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const sql = getSql();
    columns = await tableColumns("api_logs");
    if (columns.length === 0) throw new Error(t("logs.missing"));

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
    rows = data as Row[];
  } catch (e) {
    error = (e as Error).message;
  }

  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => withContext("/logs", params, { ...(q && { q }), size: String(size), page: String(p) });

  return (
    <>
      <h1>{t("logs.title")}</h1>
      <p className="sub">{t("logs.count", { n: total })}</p>

      {params.purged !== undefined && (
        <p className="card notice">{t("logs.purged", { n: params.purged })}</p>
      )}
      {error && <p className="card error">{t("common.dbError", { error })}</p>}

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <form className="row" method="get">
          {[...contextParams(params)].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" placeholder={t("logs.searchPh")} defaultValue={q} size={32} />
          <select name="size" defaultValue={String(size)}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{t("logs.perPage", { n: s })}</option>
            ))}
          </select>
          <button type="submit">{t("common.search")}</button>
        </form>
        {!error && (
          <PurgeForm
            canFilterByDate={columns.includes("created_at")}
            context={contextParams(params).toString()}
            labels={{
              purge: t("logs.purge"),
              allLogs: t("logs.allLogs"),
              olderThan: [1, 7, 30].map((n) => t("logs.olderThan", { n })),
              confirmOlder: [1, 7, 30].map((n) => t("logs.confirmOlder", { n })),
              confirmAll: t("logs.confirmAll"),
            }}
          />
        )}
      </div>

      {!error && <DataTable columns={columns} rows={rows} empty={t("logs.none")} dateParams={params} />}

      {pages > 1 && (
        <div className="row">
          {page > 1 && <a href={href(page - 1)}>{t("logs.prev")}</a>}
          <span className="sub">{t("logs.page", { page, pages })}</span>
          {page < pages && <a href={href(page + 1)}>{t("logs.next")}</a>}
        </div>
      )}
    </>
  );
}
