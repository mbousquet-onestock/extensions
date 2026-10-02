import { Empty } from "@/components/ui";
import type { Row } from "@/lib/db";
import { formatDate } from "@/lib/i18n";

type DateParams = { lang?: string; locale?: string; timezone?: string };

function statusBadge(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 100) return null;
  const color = n >= 500 ? "red" : n >= 400 ? "orange" : n >= 300 ? "blue" : "green";
  return <span className={`badge badge-${color}`}>{n}</span>;
}

export function formatValue(column: string, value: unknown, dateParams: DateParams = {}) {
  if (value === null || value === undefined || value === "") return <span className="secondary">—</span>;
  if (value instanceof Date) return <span className="nowrap secondary">{formatDate(value, dateParams)}</span>;
  if (/status/i.test(column)) {
    const badge = statusBadge(value);
    if (badge) return badge;
  }
  if (column === "method") return <span className="badge badge-grey">{String(value)}</span>;
  if (typeof value === "object") {
    return (
      <details className="reveal">
        <summary>JSON</summary>
        <pre className="code">{JSON.stringify(value, null, 2)}</pre>
      </details>
    );
  }
  const str = String(value);
  if (str.length > 120) {
    return (
      <details className="reveal">
        <summary className="mono">{str.slice(0, 60)}…</summary>
        <pre className="code">{str}</pre>
      </details>
    );
  }
  return <span className="mono">{str}</span>;
}

export default function DataTable({
  columns,
  rows,
  empty,
  dateParams,
}: {
  columns: string[];
  rows: Row[];
  empty: string;
  dateParams?: DateParams;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => (
                <td key={c} className="cell">{formatValue(c, row[c], dateParams)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <Empty title={empty} />}
    </div>
  );
}
