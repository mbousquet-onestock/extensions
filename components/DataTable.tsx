import type { Row } from "@/lib/db";

export function formatValue(value: unknown) {
  if (value === null || value === undefined) return <span className="sub">—</span>;
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    return (
      <details>
        <summary>JSON</summary>
        <pre className="mono">{JSON.stringify(value, null, 2)}</pre>
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

export default function DataTable({ columns, rows, empty }: { columns: string[]; rows: Row[]; empty: string }) {
  return (
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="sub">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
