import CopyPanel, { type CopyLabels } from "@/components/CopyPanel";
import { Alert } from "@/components/ui";
import { getT, type MessageKey } from "@/lib/i18n";
import { listNeonDatabases, neonEnabled } from "@/lib/neon";

export const dynamic = "force-dynamic";
// Une copie volumineuse peut durer plusieurs minutes (limite de la fonction Vercel).
export const maxDuration = 300;

const LABEL_KEYS = [
  "source", "target", "nameHelp", "namePlaceholder", "mode", "modeReplace", "modeReplaceHelp", "modeAppend",
  "modeAppendHelp", "analyze", "analyzing", "planTitle", "colTable", "colRows", "colTarget", "created", "replaced",
  "kept", "confirmLabel", "confirmHelp", "copy", "copying", "doneTitle", "colCopied", "duration", "warning",
  "err.not_found", "err.ambiguous", "err.neon_disabled", "err.neon", "err.connect", "err.same", "err.analyze_first",
  "err.confirm", "err.no_tables", "err.copy_failed", "selectAll", "selectNone", "createdDone",
] as const;

export default async function CopyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const t = getT(params.lang);
  const labels = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(`copy.${k}` as MessageKey)])) as CopyLabels;

  // Noms des bases Neon proposés à la saisie (autocomplétion).
  let databases: string[] = [];
  let neonError: string | null = null;
  if (neonEnabled()) {
    try {
      databases = (await listNeonDatabases()).map((d) => d.label);
    } catch (e) {
      neonError = (e as Error).message;
    }
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("copy.title")}</h1>
          <p className="page-subtitle">{t("copy.subtitle")}</p>
        </div>
      </div>
      {!neonEnabled() && <Alert type="info">{t("copy.neonSetup")}</Alert>}
      {neonError && <Alert type="danger">{t("copy.neonError", { error: neonError })}</Alert>}
      <CopyPanel labels={labels} databases={databases} />
    </div>
  );
}
