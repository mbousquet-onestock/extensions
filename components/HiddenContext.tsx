import { contextParams } from "@/lib/context";

/** Champs cachés qui conservent le contexte OneStock (et d'autres paramètres) dans un formulaire GET. */
export default function HiddenContext({
  params,
  keep = {},
}: {
  params: Record<string, string | undefined>;
  keep?: Record<string, string | undefined>;
}) {
  const entries = [...contextParams(params), ...Object.entries(keep).filter(([, v]) => v)] as [string, string][];
  return (
    <>
      {entries.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}
