import CopyPanel, { type CopyLabels } from "@/components/CopyPanel";
import { Alert } from "@/components/ui";
import { copyDatabases, copyEnabled } from "@/lib/copyConfig";
import { getT, type MessageKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";
// Une copie volumineuse peut durer plusieurs minutes (limite de la fonction Vercel).
export const maxDuration = 300;

const LABEL_KEYS = [
  "source", "target", "choose", "mode", "modeReplace", "modeReplaceHelp", "modeAppend", "modeAppendHelp", "password",
  "analyze", "analyzing", "planTitle", "colTable", "colRows", "colTarget", "created", "replaced", "kept", "confirmLabel",
  "confirmHelp", "copy", "copying", "doneTitle", "colCopied", "duration", "warning", "err.password", "err.select",
  "err.same", "err.analyze_first", "err.confirm", "err.no_tables", "err.copy_failed", "selectAll", "selectNone", "createdDone",
] as const;

export default async function CopyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const t = getT(params.lang);
  const databases = copyDatabases();
  const labels = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(`copy.${k}` as MessageKey)])) as CopyLabels;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("copy.title")}</h1>
          <p className="page-subtitle">{t("copy.subtitle")}</p>
        </div>
      </div>
      {!copyEnabled() ? (
        <Alert type="info">{t("copy.disabled")}</Alert>
      ) : databases.length < 2 ? (
        <Alert type="info">{t("copy.needTwo", { n: databases.length })}</Alert>
      ) : (
        <CopyPanel databases={databases} labels={labels} />
      )}
    </div>
  );
}
