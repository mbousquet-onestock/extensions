"use client";

import { startTransition, useActionState, useState } from "react";
import { copyStep, type CopyState } from "@/app/copy/actions";
import { Alert, Icon } from "@/components/ui";
import type { CopyDatabase } from "@/lib/copyConfig";

export type CopyLabels = Record<
  | "source" | "target" | "choose" | "mode" | "modeReplace" | "modeReplaceHelp" | "modeAppend" | "modeAppendHelp"
  | "password" | "analyze" | "analyzing" | "planTitle" | "colTable" | "colRows" | "colTarget" | "created" | "replaced"
  | "kept" | "confirmLabel" | "confirmHelp" | "copy" | "copying" | "doneTitle" | "colCopied" | "duration" | "warning"
  | "err.password" | "err.select" | "err.same" | "err.analyze_first" | "err.confirm" | "err.no_tables" | "err.copy_failed"
  | "selectAll" | "selectNone" | "createdDone",
  string
>;

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export default function CopyPanel({ databases, labels }: { databases: CopyDatabase[]; labels: CopyLabels }) {
  const [state, action, pending] = useActionState<CopyState, FormData>(copyStep, { step: "idle" });
  const [password, setPassword] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [selected, setSelected] = useState<string[] | null>(null);

  // Le plan affiché ne vaut que pour les bases analysées.
  const planValid = state.step !== "idle" && state.source === source && state.target === target;
  const plan = planValid ? state.plan ?? [] : [];
  const checked = selected ?? plan.map((p) => p.table);
  const errorKey = state.error?.split(":")[0];
  const errorLabel = errorKey ? (labels as Record<string, string>)[`err.${errorKey}`] : undefined;
  const errorText = state.error
    ? errorLabel
      ? errorLabel + (errorKey === "copy_failed" ? ` ${state.error.slice("copy_failed:".length)}` : "")
      : state.error
    : null;
  const host = (name: string) => databases.find((d) => d.name === name)?.host ?? "";

  return (
    <form
      className="stack"
      // Envoi manuel : une action de formulaire réinitialiserait les champs après chaque étape
      // (bases choisies, tables cochées), alors qu'ils doivent rester d'une étape à l'autre.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(data));
      }}
    >
      <div className="card">
        <div className="form-grid">
          <label className="field">
            <span className="field-label">{labels.source}</span>
            <select className="select" name="source" value={source} required onChange={(e) => { setSource(e.target.value); setSelected(null); }}>
              <option value="">{labels.choose}</option>
              {databases.map((d) => (
                <option key={d.name} value={d.name}>{d.label}</option>
              ))}
            </select>
            {source && <span className="field-help mono">{host(source)}</span>}
          </label>
          <label className="field">
            <span className="field-label">{labels.target}</span>
            <select className="select" name="target" value={target} required onChange={(e) => { setTarget(e.target.value); setSelected(null); }}>
              <option value="">{labels.choose}</option>
              {databases.filter((d) => d.name !== source).map((d) => (
                <option key={d.name} value={d.name}>{d.label}</option>
              ))}
            </select>
            {target && <span className="field-help mono">{host(target)}</span>}
          </label>
          <fieldset className="field full radio-group">
            <legend className="field-label">{labels.mode}</legend>
            <label className="radio">
              <input type="radio" name="mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span><strong>{labels.modeReplace}</strong> — {labels.modeReplaceHelp}</span>
            </label>
            <label className="radio">
              <input type="radio" name="mode" value="append" checked={mode === "append"} onChange={() => setMode("append")} />
              <span><strong>{labels.modeAppend}</strong> — {labels.modeAppendHelp}</span>
            </label>
          </fieldset>
          <label className="field">
            <span className="field-label">{labels.password}</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <div className="row-end">
          <button className="btn btn-secondary" type="submit" name="intent" value="analyze" disabled={pending || !source || !target}>
            <Icon name="search" />
            {pending ? labels.analyzing : labels.analyze}
          </button>
        </div>
      </div>

      {errorText && <Alert type="danger">{errorText}</Alert>}

      {planValid && state.step === "analyzed" && plan.length > 0 && (
        <div className="card flush">
          <div className="toolbar">
            <h2 className="section-title" style={{ flex: 1 }}>
              {fill(labels.planTitle, { source: state.sourceHost ?? "", target: state.targetHost ?? "" })}
            </h2>
            <button type="button" className="btn btn-tertiary btn-small" onClick={() => setSelected(plan.map((p) => p.table))}>{labels.selectAll}</button>
            <button type="button" className="btn btn-tertiary btn-small" onClick={() => setSelected([])}>{labels.selectNone}</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>{labels.colTable}</th>
                <th className="num">{labels.colRows}</th>
                <th>{labels.colTarget}</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.table}>
                  <td>
                    <input
                      type="checkbox"
                      name="tables"
                      value={p.table}
                      checked={checked.includes(p.table)}
                      onChange={(e) => setSelected(e.target.checked ? [...checked, p.table] : checked.filter((t) => t !== p.table))}
                    />
                  </td>
                  <td className="mono">{p.table}</td>
                  <td className="num">{p.rows.toLocaleString()}</td>
                  <td>
                    {!p.inTarget ? (
                      <span className="badge badge-blue">{labels.created}</span>
                    ) : mode === "replace" ? (
                      <span className="badge badge-orange">{fill(labels.replaced, { n: p.targetRows ?? 0 })}</span>
                    ) : (
                      <span className="badge badge-grey">{fill(labels.kept, { n: p.targetRows ?? 0 })}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="copy-confirm">
            {mode === "replace" && <Alert type="danger">{labels.warning}</Alert>}
            <label className="field">
              <span className="field-label">{labels.confirmLabel}</span>
              <input className="input mono" name="confirm" autoComplete="off" placeholder="COPIER" />
              <span className="field-help">{labels.confirmHelp}</span>
            </label>
            <div className="row-end">
              <button className="btn btn-primary" type="submit" name="intent" value="copy" disabled={pending || checked.length === 0}>
                <Icon name="download" />
                {pending ? labels.copying : labels.copy}
              </button>
            </div>
          </div>
        </div>
      )}

      {planValid && state.step === "done" && state.results && (
        <div className="card flush">
          <div className="toolbar">
            <h2 className="section-title" style={{ flex: 1 }}>{labels.doneTitle}</h2>
            <span className="secondary">{fill(labels.duration, { s: ((state.durationMs ?? 0) / 1000).toFixed(1) })}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>{labels.colTable}</th>
                <th className="num">{labels.colCopied}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.results.map((r) => (
                <tr key={r.table}>
                  <td className="mono">{r.table}</td>
                  <td className="num">{r.copied.toLocaleString()} / {r.rows.toLocaleString()}</td>
                  <td className="secondary">
                    {r.created && <span className="badge badge-blue">{labels.createdDone}</span>}{" "}
                    {r.missing.length > 0 && <span className="badge badge-orange" title={r.missing.join(", ")}>{r.missing.join(", ")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
