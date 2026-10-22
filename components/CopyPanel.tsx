"use client";

import { startTransition, useActionState, useState } from "react";
import { copyStep, type CopyState } from "@/app/copy/actions";
import { Alert, Icon } from "@/components/ui";

export type CopyLabels = Record<
  | "source" | "target" | "nameHelp" | "namePlaceholder" | "mode" | "modeReplace" | "modeReplaceHelp" | "modeAppend" | "modeAppendHelp"
  | "analyze" | "analyzing" | "planTitle" | "colTable" | "colRows" | "colTarget" | "created" | "replaced"
  | "kept" | "confirmLabel" | "confirmHelp" | "copy" | "copying" | "doneTitle" | "colCopied" | "duration" | "warning"
  | "err.not_found" | "err.ambiguous" | "err.neon_disabled" | "err.neon" | "err.connect" | "err.same" | "err.analyze_first" | "err.confirm" | "err.no_tables" | "err.copy_failed"
  | "selectAll" | "selectNone" | "createdDone",
  string
>;

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** Hôte et base d'une URL Postgres, pour vérifier la saisie sans afficher le mot de passe. */
function hostOf(url: string) {
  try {
    const u = new URL(url.trim());
    if (!/^postgres(ql)?:$/.test(u.protocol)) return "";
    // Neon : l'URL poolée et l'URL directe désignent la même base (la copie passe par l'URL directe).
    const host = u.hostname.endsWith(".neon.tech") ? u.hostname.replace("-pooler.", ".") : u.hostname;
    return `${host}/${u.pathname.slice(1) || "postgres"}`;
  } catch {
    return "";
  }
}

const isUrl = (v: string) => /^postgres(ql)?:\/\//i.test(v.trim());

export default function CopyPanel({ labels, databases }: { labels: CopyLabels; databases: string[] }) {
  const [state, action, pending] = useActionState<CopyState, FormData>(copyStep, { step: "idle" });
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [selected, setSelected] = useState<string[] | null>(null);

  // Le plan affiché ne vaut que pour les bases analysées (mêmes saisies).
  const [analyzedFor, setAnalyzedFor] = useState<string | null>(null);
  const planValid = state.step !== "idle" && analyzedFor === `${source.trim()}\n${target.trim()}`;
  const plan = planValid ? state.plan ?? [] : [];
  const checked = selected ?? plan.map((p) => p.table);
  const errorKey = state.error?.split(":")[0];
  const errorLabel = errorKey ? (labels as Record<string, string>)[`err.${errorKey}`] : undefined;
  const errorText = state.error
    ? errorLabel
      ? errorLabel + (state.error.includes(":") ? ` ${state.error.slice(errorKey!.length + 1).trim()}` : "")
      : state.error
    : null;

  return (
    <form
      className="stack"
      // Envoi manuel : une action de formulaire réinitialiserait les champs après chaque étape
      // (bases choisies, tables cochées), alors qu'ils doivent rester d'une étape à l'autre.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        if (data.get("intent") === "analyze") setAnalyzedFor(`${source.trim()}\n${target.trim()}`);
        startTransition(() => action(data));
      }}
    >
      <div className="card">
        <div className="form-grid">
          <datalist id="neon-databases">
            {databases.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {(
            [
              ["source", labels.source, source, setSource],
              ["target", labels.target, target, setTarget],
            ] as const
          ).map(([name, label, value, set]) => (
            <label className="field" key={name}>
              <span className="field-label">{label}</span>
              <input
                className="input"
                // Une URL collée (repli sans clé Neon) est masquée : elle contient le mot de passe.
                type={isUrl(value) ? "password" : "text"}
                name={name}
                list="neon-databases"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder={labels.namePlaceholder}
                value={value}
                onChange={(e) => {
                  set(e.target.value);
                  setSelected(null);
                }}
              />
              <span className="field-help">
                {isUrl(value) && hostOf(value) ? <span className="mono">{hostOf(value)}</span> : labels.nameHelp}
              </span>
            </label>
          ))}
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
        </div>
        <div className="row-end">
          <button className="btn btn-secondary" type="submit" name="intent" value="analyze" disabled={pending || !source.trim() || !target.trim()}>
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
              {fill(labels.planTitle, { source: state.sourceName ?? "", target: state.targetName ?? "" })}
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
              <input className="input mono" name="confirm" autoComplete="off" placeholder={state.targetName} />
              <span className="field-help">{fill(labels.confirmHelp, { target: state.targetName ?? "" })}</span>
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
