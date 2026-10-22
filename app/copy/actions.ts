"use server";

import { logApiCallLater } from "@/lib/apiLogs";
import { analyzeCopy, describeUrl, runCopy, type CopyPlanItem, type CopyResult } from "@/lib/dbCopy.mjs";

export type CopyState = {
  step: "idle" | "analyzed" | "done";
  error?: string;
  /** Hôte/base analysés (jamais l'URL complète, qui contient le mot de passe). */
  sourceHost?: string;
  targetHost?: string;
  mode?: "replace" | "append";
  plan?: CopyPlanItem[];
  results?: CopyResult[];
  durationMs?: number;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const isPostgresUrl = (u: string) => /^postgres(ql)?:\/\/[^\s]+$/i.test(u);

/**
 * Étape « Analyser » (aucune écriture) ou « Copier » de l'onglet Copie de base,
 * selon le bouton utilisé (`intent`). Les URL saisies ne sont utilisées que côté serveur, le temps de l'opération.
 */
export async function copyStep(prev: CopyState, form: FormData): Promise<CopyState> {
  const intent = text(form, "intent");
  const sourceUrl = text(form, "source_url");
  const targetUrl = text(form, "target_url");
  const mode = text(form, "mode") === "append" ? "append" : "replace";
  const base: CopyState = { ...prev, mode, error: undefined };

  if (!isPostgresUrl(sourceUrl) || !isPostgresUrl(targetUrl)) return { ...base, error: "url" };
  let sourceHost: string;
  let targetHost: string;
  try {
    sourceHost = describeUrl(sourceUrl);
    targetHost = describeUrl(targetUrl);
  } catch {
    return { ...base, error: "url" };
  }
  if (sourceHost === targetHost) return { ...base, error: "same" };

  if (intent === "analyze") {
    try {
      const res = await analyzeCopy({ sourceUrl, targetUrl });
      return { ...base, step: "analyzed", plan: res.plan, sourceHost, targetHost, results: undefined };
    } catch (e) {
      return { ...base, step: "idle", error: `connect: ${(e as Error).message}` };
    }
  }

  // Copie : sur le plan analysé pour ces mêmes bases, avec la confirmation saisie et des tables cochées.
  if (prev.step === "idle" || prev.sourceHost !== sourceHost || prev.targetHost !== targetHost) {
    return { ...base, error: "analyze_first" };
  }
  if (text(form, "confirm") !== "COPIER") return { ...base, error: "confirm" };
  const tables = form.getAll("tables").map(String);
  if (tables.length === 0) return { ...base, error: "no_tables" };

  const started = Date.now();
  try {
    const res = await runCopy({ sourceUrl, targetUrl, tables, mode });
    logApiCallLater({
      api: "Copie de base",
      method: "COPY",
      path: `${sourceHost} → ${targetHost}`,
      status: 200,
      durationMs: res.durationMs,
      request: { source: sourceHost, target: targetHost, mode, tables },
      response: { results: res.results },
      result: `${res.results.reduce((n, r) => n + r.copied, 0)} ligne(s), ${res.results.length} table(s)`,
    });
    return { ...base, step: "done", results: res.results, durationMs: res.durationMs };
  } catch (e) {
    logApiCallLater({
      api: "Copie de base",
      method: "COPY",
      path: `${sourceHost} → ${targetHost}`,
      status: 500,
      durationMs: Date.now() - started,
      request: { source: sourceHost, target: targetHost, mode, tables },
      error: (e as Error).message,
    });
    return { ...base, step: "analyzed", error: `copy_failed: ${(e as Error).message}` };
  }
}
