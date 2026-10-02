"use client";

import { Fragment, useState } from "react";
import Payload from "@/components/Payload";

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
                      <div className="log-meta">
                        {e.method && <span className="badge badge-grey">{e.method}</span>}
                        <span className="mono log-url">{e.path}</span>
                        {e.status !== null && <span className={`badge ${statusBadge(e.status)}`}>{e.status}</span>}
                        {e.duration && <span className="secondary">{e.duration}</span>}
                        <span className="secondary">{e.time}</span>
                      </div>
                      <div className="log-details">
                        <Payload title={labels.request} raw={e.request} copyLabel={labels.copy} copiedLabel={labels.copied} />
                        {e.error ? (
                          <Payload title={labels.error} raw={e.error} error copyLabel={labels.copy} copiedLabel={labels.copied} />
                        ) : (
                          <Payload title={labels.response} raw={e.response} copyLabel={labels.copy} copiedLabel={labels.copied} />
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
