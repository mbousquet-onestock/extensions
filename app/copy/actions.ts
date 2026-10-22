"use server";

import { logApiCallLater } from "@/lib/apiLogs";
import { analyzeCopy, describeUrl, runCopy, type CopyPlanItem, type CopyResult } from "@/lib/dbCopy.mjs";
import { DatabaseNameError, findNeonDatabase, neonConnectionUrl, neonEnabled } from "@/lib/neon";

export type CopyState = {
  step: "idle" | "analyzed" | "done";
  error?: string;
  /** Bases analysées : nom saisi et hôte/base (jamais l'URL complète, qui contient le mot de passe). */
  sourceName?: string;
  targetName?: string;
  sourceHost?: string;
  targetHost?: string;
  mode?: "replace" | "append";
  plan?: CopyPlanItem[];
  results?: CopyResult[];
  durationMs?: number;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const isPostgresUrl = (u: string) => /^postgres(ql)?:\/\/[^\s]+$/i.test(u);

/** Base saisie par son nom (API Neon) ou, à défaut, par son URL de connexion. */
async function resolve(input: string): Promise<{ url: string; name: string; host: string }> {
  if (isPostgresUrl(input)) return { url: input, name: describeUrl(input), host: describeUrl(input) };
  if (!input) throw new DatabaseNameError("not_found", "");
  if (!neonEnabled()) throw new Error("neon_disabled");
  const db = await findNeonDatabase(input);
  const url = await neonConnectionUrl(db);
  return { url, name: db.label, host: describeUrl(url) };
}

/**
 * Étape « Analyser » (aucune écriture) ou « Copier » de l'onglet Copie de base,
 * selon le bouton utilisé (`intent`). Les URL saisies ne sont utilisées que côté serveur, le temps de l'opération.
 */
export async function copyStep(prev: CopyState, form: FormData): Promise<CopyState> {
  const intent = text(form, "intent");
  const mode = text(form, "mode") === "append" ? "append" : "replace";
  const base: CopyState = { ...prev, mode, error: undefined };

  let source: Awaited<ReturnType<typeof resolve>>;
  let target: Awaited<ReturnType<typeof resolve>>;
  try {
    [source, target] = await Promise.all([resolve(text(form, "source")), resolve(text(form, "target"))]);
  } catch (e) {
    if (e instanceof DatabaseNameError) return { ...base, error: `${e.code}: ${e.detail}` };
    const msg = (e as Error).message;
    return { ...base, error: msg === "neon_disabled" ? "neon_disabled" : `neon: ${msg}` };
  }
  const { url: sourceUrl, host: sourceHost, name: sourceName } = source;
  const { url: targetUrl, host: targetHost, name: targetName } = target;
  if (sourceHost === targetHost) return { ...base, error: "same" };

  if (intent === "analyze") {
    try {
      const res = await analyzeCopy({ sourceUrl, targetUrl });
      return { ...base, step: "analyzed", plan: res.plan, sourceHost, targetHost, sourceName, targetName, results: undefined };
    } catch (e) {
      return { ...base, step: "idle", error: `connect: ${(e as Error).message}` };
    }
  }

  // Copie : sur le plan analysé pour ces mêmes bases, avec la confirmation saisie et des tables cochées.
  if (prev.step === "idle" || prev.sourceHost !== sourceHost || prev.targetHost !== targetHost) {
    return { ...base, error: "analyze_first" };
  }
  // Confirmation : nom de la base de destination, recopié.
  const confirm = text(form, "confirm").toLowerCase();
  if (!confirm || ![targetName.toLowerCase(), text(form, "target").toLowerCase()].includes(confirm)) {
    return { ...base, error: "confirm" };
  }
  const tables = form.getAll("tables").map(String);
  if (tables.length === 0) return { ...base, error: "no_tables" };

  const started = Date.now();
  try {
    const res = await runCopy({ sourceUrl, targetUrl, tables, mode });
    logApiCallLater({
      api: "Copie de base",
      method: "COPY",
      path: `${sourceName} (${sourceHost}) → ${targetName} (${targetHost})`,
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
      path: `${sourceName} (${sourceHost}) → ${targetName} (${targetHost})`,
      status: 500,
      durationMs: Date.now() - started,
      request: { source: sourceHost, target: targetHost, mode, tables },
      error: (e as Error).message,
    });
    return { ...base, step: "analyzed", error: `copy_failed: ${(e as Error).message}` };
  }
}
