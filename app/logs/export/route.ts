import { readLogs, toEntry } from "@/lib/apiLogs";

export const dynamic = "force-dynamic";

const COLUMNS = ["time", "api", "method", "path", "status", "duration", "result", "request", "response", "error"] as const;

function csvCell(value: unknown) {
  const s = value instanceof Date ? value.toISOString() : String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV des appels API filtrés (mêmes filtres que la page, secrets masqués). */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const data = await readLogs(
    {
      siteId: p.get("site_id") || undefined,
      api: p.get("api") || undefined,
      errorsOnly: p.get("errors") === "1",
      search: p.get("q")?.trim() || undefined,
    },
    50000,
  );
  if (!data) return new Response("api_logs not found", { status: 404 });

  const lines = [COLUMNS.join(",")];
  data.rows.forEach((row, i) => {
    const e = toEntry(row, data.map, i, { entries: (n) => `${n} entries`, ok: "OK" });
    lines.push(COLUMNS.map((c) => csvCell(e[c])).join(","));
  });
  const site = p.get("site_id");
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="api-calls${site ? `-${site}` : ""}.csv"`,
    },
  });
}
