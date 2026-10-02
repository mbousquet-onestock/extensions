"use client";

import { useState } from "react";
import { isFlatObject, parsePayload } from "@/lib/payload";

const TOKEN = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** JSON indenté avec coloration des clés, chaînes, nombres et littéraux. */
function HighlightedJson({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) nodes.push(text.slice(last, m.index));
    const [whole, str, colon, literal, num] = m;
    if (str && colon) nodes.push(<span key={i++} className="j-key">{str}</span>, colon);
    else if (str) nodes.push(<span key={i++} className="j-str">{str}</span>);
    else if (literal) nodes.push(<span key={i++} className="j-lit">{literal}</span>);
    else if (num) nodes.push(<span key={i++} className="j-num">{num}</span>);
    else nodes.push(whole);
    last = m.index! + whole.length;
  }
  nodes.push(text.slice(last));
  return <pre className="payload-code">{nodes}</pre>;
}

function Scalar({ value }: { value: unknown }) {
  if (value === null) return <span className="j-lit">null</span>;
  if (typeof value === "boolean") return <span className="j-lit">{String(value)}</span>;
  if (typeof value === "number") return <span className="j-num">{value}</span>;
  return <span className="j-plain">{String(value)}</span>;
}

/** Valeur structurée : tableau clé / valeur si l'objet est plat, sinon JSON coloré. */
function Structured({ value }: { value: unknown }) {
  if (isFlatObject(value)) {
    return (
      <dl className="payload-kv">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd><Scalar value={v} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <HighlightedJson value={value} />;
}

export default function Payload({
  title,
  raw,
  error,
  copyLabel,
  copiedLabel,
}: {
  title: string;
  raw: string;
  error?: boolean;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const parsed = parsePayload(raw);

  return (
    <section className={`payload${error ? " is-error" : ""}`}>
      <header className="payload-head">
        <strong>{title}</strong>
        {parsed.kind !== "empty" && (
          <button
            type="button"
            className="btn btn-tertiary btn-small"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard?.writeText(raw).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? copiedLabel : copyLabel}
          </button>
        )}
      </header>
      <div className="payload-body">
        {parsed.kind === "empty" && <span className="secondary">—</span>}
        {parsed.kind === "text" && <p className="payload-text">{parsed.text}</p>}
        {parsed.kind === "json" && <Structured value={parsed.value} />}
        {parsed.kind === "mixed" && (
          <>
            <p className="payload-text">{parsed.text}</p>
            <Structured value={parsed.value} />
          </>
        )}
      </div>
    </section>
  );
}
