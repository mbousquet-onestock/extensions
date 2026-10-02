"use client";

import { Fragment, useState } from "react";

export type LogEntry = {
  key: string;
  time: string;
  api: string | null;
  method: string | null;
  path: string;
  status: number | null;
  duration: string | null;
  result: string;
  isError: boolean;
  request: string;
  response: string;
  error: string;
};

type Labels = {
  time: string;
  api: string;
  method: string;
  path: string;
  status: string;
  duration: string;
  result: string;
  request: string;
  response: string;
  error: string;
  copy: string;
  copied: string;
  empty: string;
};

function apiBadge(api: string) {
  const v = api.toLowerCase();
  if (v.includes("onestock")) return "badge-brand";
  if (v.includes("database") || v === "db" || v.includes("sql")) return "badge-purple";
  return "badge-grey";
}

function statusBadge(status: number) {
  return status >= 500 ? "badge-red" : status >= 400 ? "badge-orange" : status >= 300 ? "badge-blue" : "badge-green";
}

function CodeBlock({ title, value, labels, error }: { title: string; value: string; labels: Labels; error?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="log-block">
      <div className="log-block-head">
        <strong>{title}</strong>
        {value && (
          <button
            type="button"
            className="btn btn-tertiary btn-small"
            onClick={() => {
              navigator.clipboard?.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? labels.copied : labels.copy}
          </button>
        )}
      </div>
      <pre className={`log-code${error ? " error" : ""}`}>{value || "—"}</pre>
    </div>
  );
}

export default function LogsTable({ entries, labels, showApi }: { entries: LogEntry[]; labels: Labels; showApi: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const cols = showApi ? 7 : 6;

  return (
    <div className="table-wrap">
      <table className="table logs">
        <thead>
          <tr>
            <th>{labels.time}</th>
            {showApi && <th>{labels.api}</th>}
            <th>{labels.method}</th>
            <th>{labels.path}</th>
            <th className="num">{labels.status}</th>
            <th className="num">{labels.duration}</th>
            <th>{labels.result}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isOpen = open === e.key;
            return (
              <Fragment key={e.key}>
                <tr
                  className={`clickable${isOpen ? " open" : ""}`}
                  onClick={() => setOpen(isOpen ? null : e.key)}
                  aria-expanded={isOpen}
                >
                  <td className="nowrap">{e.time}</td>
                  {showApi && <td>{e.api && <span className={`badge ${apiBadge(e.api)}`}>{e.api}</span>}</td>}
                  <td>{e.method && <span className="badge badge-grey">{e.method}</span>}</td>
                  <td className="mono path">{e.path}</td>
                  <td className="num">{e.status !== null && <span className={`badge ${statusBadge(e.status)}`}>{e.status}</span>}</td>
                  <td className="num nowrap">{e.duration}</td>
                  <td className={`result${e.isError ? " error" : ""}`}>{e.result}</td>
                </tr>
                {isOpen && (
                  <tr className="details">
                    <td colSpan={cols}>
                      <div className="log-details">
                        <CodeBlock title={labels.request} value={e.request} labels={labels} />
                        {e.error ? (
                          <CodeBlock title={labels.error} value={e.error} labels={labels} error />
                        ) : (
                          <CodeBlock title={labels.response} value={e.response} labels={labels} />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {entries.length === 0 && (
        <div className="empty"><strong>{labels.empty}</strong></div>
      )}
    </div>
  );
}
