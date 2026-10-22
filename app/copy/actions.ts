"use server";

import { logApiCallLater } from "@/lib/apiLogs";
import { checkCopyPassword, copyDatabaseUrl } from "@/lib/copyConfig";
import { analyzeCopy, runCopy, type CopyPlanItem, type CopyResult } from "@/lib/dbCopy.mjs";

export type CopyState = {
  step: "idle" | "analyzed" | "done";
  error?: string;
  source?: string;
  target?: string;
  sourceHost?: string;
  targetHost?: string;
  mode?: "replace" | "append";
  plan?: CopyPlanItem[];
  results?: CopyResult[];
  log?: string[];
  durationMs?: number;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * Étape « Analyser » (aucune écriture) ou « Copier » de l'onglet Copie de base,
 * selon le bouton utilisé (`intent`). Le mot de passe est vérifié à chaque appel.
 */
export async function copyStep(prev: CopyState, form: FormData): Promise<CopyState> {
  const intent = text(form, "intent");
  const source = text(form, "source");
  const target = text(form, "target");
  const mode = text(form, "mode") === "append" ? "append" : "replace";
  const base: CopyState = { ...prev, source, target, mode, error: undefined };

  if (!checkCopyPassword(String(form.get("password") ?? ""))) return { ...base, error: "password" };
  const sourceUrl = copyDatabaseUrl(source);
  const targetUrl = copyDatabaseUrl(target);
  if (!sourceUrl || !targetUrl) return { ...base, error: "select" };
  if (source === target) return { ...base, error: "same" };

  if (intent === "analyze") {
    try {
      const res = await analyzeCopy({ sourceUrl, targetUrl });
      return { ...base, step: "analyzed", plan: res.plan, sourceHost: res.source, targetHost: res.target, results: undefined };
    } catch (e) {
      return { ...base, step: "idle", error: (e as Error).message };
    }
  }

  // Copie : confirmation saisie + tables cochées, sur le plan analysé pour ces mêmes bases.
  if (prev.step !== "analyzed" || prev.source !== source || prev.target !== target) return { ...base, error: "analyze_first" };
  if (text(form, "confirm") !== "COPIER") return { ...base, error: "confirm" };
  const tables = form.getAll("tables").map(String);
  if (tables.length === 0) return { ...base, error: "no_tables" };

  const started = Date.now();
  const log: string[] = [];
  try {
    const res = await runCopy({ sourceUrl, targetUrl, tables, mode, log: (l) => log.push(l) });
    logApiCallLater({
      api: "Copie de base",
      method: "COPY",
      path: `${source} (${res.source}) → ${target} (${res.target})`,
      status: 200,
      durationMs: res.durationMs,
      request: { source, target, mode, tables },
      response: { results: res.results },
      result: `${res.results.reduce((n, r) => n + r.copied, 0)} ligne(s), ${res.results.length} table(s)`,
    });
    return { ...base, step: "done", results: res.results, log, durationMs: res.durationMs };
  } catch (e) {
    logApiCallLater({
      api: "Copie de base",
      method: "COPY",
      path: `${source} → ${target}`,
      status: 500,
      durationMs: Date.now() - started,
      request: { source, target, mode, tables },
      error: (e as Error).message,
    });
    return { ...base, step: "analyzed", error: `copy_failed: ${(e as Error).message}`, log };
  }
}
