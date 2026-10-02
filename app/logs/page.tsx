import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import DataTable from "@/components/DataTable";
import HiddenContext from "@/components/HiddenContext";
import { Alert, Icon } from "@/components/ui";
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

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("logs.title")}</h1>
          <p className="page-subtitle">{t("logs.subtitle")}</p>
        </div>
      </div>

      {params.purged !== undefined && <Alert type="success">{t("logs.purged", { n: params.purged })}</Alert>}
      {error && <Alert type="danger">{t("common.dbError", { error })}</Alert>}

      {!error && (
        <div className="card flush">
          <div className="toolbar">
            <form method="get">
              <HiddenContext params={params} keep={{ size: String(size) }} />
              <div className="search">
                <input className="input" name="q" placeholder={t("logs.searchPh")} defaultValue={q} aria-label={t("logs.searchPh")} />
                <Icon name="search" />
              </div>
            </form>
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
          </div>

          <div className="subbar" style={{ justifyContent: "flex-end" }}>
            <div className="pagination">
              <span className="range">{t("logs.range", { from, to, total })}</span>
              <form method="get">
                <HiddenContext params={params} keep={{ q }} />
                <AutoSubmitSelect name="size" defaultValue={String(size)} aria-label={t("logs.perPage", { n: "" })}>
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{t("logs.perPage", { n: s })}</option>
                  ))}
                </AutoSubmitSelect>
              </form>
              {page > 1 ? (
                <Link href={href(page - 1)} className="btn btn-icon" aria-label={t("logs.prev")} title={t("logs.prev")}>
                  <Icon name="chevronLeft" />
                </Link>
              ) : (
                <span className="btn btn-icon" style={{ opacity: 0.3 }}><Icon name="chevronLeft" /></span>
              )}
              {page < pages ? (
                <Link href={href(page + 1)} className="btn btn-icon" aria-label={t("logs.next")} title={t("logs.next")}>
                  <Icon name="chevronRight" />
                </Link>
              ) : (
                <span className="btn btn-icon" style={{ opacity: 0.3 }}><Icon name="chevronRight" /></span>
              )}
            </div>
          </div>

          <DataTable columns={columns} rows={rows} empty={t("logs.none")} dateParams={params} />
        </div>
      )}
    </div>
  );
}
