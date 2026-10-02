import Link from "next/link";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import ConfirmButton from "@/components/ConfirmButton";
import HiddenContext from "@/components/HiddenContext";
import LogsTable, { type LogEntry } from "@/components/LogsTable";
import ErrorsOnlyToggle from "@/components/ErrorsOnlyToggle";
import { Alert, Icon } from "@/components/ui";
import { LOGS_TABLE, readLogs, toEntry } from "@/lib/apiLogs";
import { withContext } from "@/lib/context";
import { formatDate, getT } from "@/lib/i18n";
import { clearLogsAction } from "../actions";

export const dynamic = "force-dynamic";

const STEP = 100;
const SLOT = "\u0000";

/** Insère une valeur en « tag » à la place du marqueur dans une phrase traduite. */
function withTag(sentence: string, value: string) {
  const [before, after = ""] = sentence.split(SLOT);
  return (
    <>
      {before}
      <span className="tag">{value}</span>
      {after}
    </>
  );
}

export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const t = getT(params.lang);
  const siteId = params.site_id;
  const filters = {
    siteId,
    api: params.api || undefined,
    errorsOnly: params.errors === "1",
    search: (params.q ?? "").trim() || undefined,
  };
  const limit = Math.min(5000, Math.max(STEP, Number(params.limit) || STEP));

  let data: Awaited<ReturnType<typeof readLogs>> = null;
  let error: string | null = null;
  try {
    data = await readLogs(filters, limit);
    if (!data) error = t("logs.missing");
  } catch (e) {
    error = (e as Error).message;
  }

  const view: Record<string, string> = {
    ...(filters.api && { api: filters.api }),
    ...(filters.errorsOnly && { errors: "1" }),
    ...(filters.search && { q: filters.search }),
  };
  const here = withContext("/logs", params, view);
  const siteScoped = !!(siteId && data?.map.site);

  const entries: LogEntry[] = (data?.rows ?? []).map((row, i) => {
    const e = toEntry(row, data!.map, i, { entries: (n) => t("calls.entries", { n }), ok: t("calls.ok") });
    return { ...e, time: e.time instanceof Date ? formatDate(e.time, params) : String(e.time ?? "") };
  });

  return (
    <div className="stack">
      <div className="page-header" style={{ alignItems: "flex-start" }}>
        <div className="intro">
          <h1 className="page-title">{t("calls.title")}</h1>
          <p className="page-subtitle">
            {t("calls.intro")} {withTag(t("calls.stored", { table: SLOT }), LOGS_TABLE)}
            {siteScoped && <> {withTag(t("calls.forSite", { site: SLOT }), siteId!)}</>}.
          </p>
        </div>
        {data && (
          <div className="row-actions" style={{ display: "flex", gap: 8 }}>
            <a
              className="btn btn-secondary"
              href={withContext("/logs/export", params, view)}
              download
            >
              <Icon name="download" />
              {t("calls.export")}
            </a>
            <form action={clearLogsAction}>
              <input type="hidden" name="back" value={here} />
              {siteScoped && <input type="hidden" name="site_id" value={siteId} />}
              <ConfirmButton
                className="btn btn-secondary"
                message={siteScoped ? t("calls.confirmClearSite", { site: siteId! }) : t("calls.confirmClear")}
              >
                {t("calls.clear")}
              </ConfirmButton>
            </form>
          </div>
        )}
      </div>

      {params.cleared !== undefined && <Alert type="success">{t("calls.cleared", { n: params.cleared })}</Alert>}
      {error && <Alert type="danger">{t("common.dbError", { error })}</Alert>}

      {data && (
        <div className="card flush">
          <form method="get" className="toolbar">
            <HiddenContext params={params} />
            {data.apis.length > 0 && (
              <AutoSubmitSelect name="api" defaultValue={filters.api ?? ""} aria-label={t("calls.colApi")}>
                <option value="">{t("calls.allApis")}</option>
                {data.apis.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </AutoSubmitSelect>
            )}
            <ErrorsOnlyToggle checked={filters.errorsOnly} label={t("calls.errorsOnly", { n: data.errors })} />
            <div className="search">
              <input className="input" name="q" defaultValue={filters.search} placeholder={t("calls.searchPh")} aria-label={t("calls.searchPh")} />
              <Icon name="search" />
            </div>
            <span className="secondary nowrap" style={{ fontSize: 13 }}>
              {t("calls.shown", { shown: entries.length, total: data.total })}
            </span>
          </form>

          <LogsTable
            entries={entries}
            showApi={!!data.map.api}
            labels={{
              time: t("calls.colTime"),
              api: t("calls.colApi"),
              method: t("calls.colMethod"),
              path: t("calls.colPath"),
              status: t("calls.colStatus"),
              duration: t("calls.colDuration"),
              result: t("calls.colResult"),
              request: t("calls.request"),
              response: t("calls.response"),
              error: t("calls.error"),
              copy: t("calls.copy"),
              copied: t("calls.copied"),
              empty: t("calls.none"),
            }}
          />

          {entries.length < data.total && (
            <div style={{ padding: 16, textAlign: "center", borderTop: "1px solid var(--border-primary)" }}>
              <Link href={withContext("/logs", params, { ...view, limit: String(limit + STEP) })} className="btn btn-secondary" scroll={false}>
                {t("calls.loadMore")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
