import Payload from "@/components/Payload";
import { Icon } from "@/components/ui";
import { formatDate, type T } from "@/lib/i18n";
import { iconSrc, type OneStockExtension } from "@/lib/onestock";

/** Remplace les images base64 par un libellé court pour la vue JSON brute. */
function withoutImages(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "icon" && typeof v === "string" && v.length > 100 ? `[base64, ${v.length} chars]` : withoutImages(v),
      ]),
    );
  }
  return value;
}

function Img({ icon, large }: { icon?: string; large?: boolean }) {
  const src = iconSrc(icon);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`ext-icon${large ? " large" : ""}`} />
  ) : (
    <span className={`ext-icon placeholder${large ? " large" : ""}`}><Icon name="cube" /></span>
  );
}

/** Toutes les données renvoyées par GET /extensions/{id}, en lecture seule. */
export default function ApiExtensionDetails({
  ext,
  t,
  dateParams,
}: {
  ext: OneStockExtension;
  t: T;
  dateParams: { lang?: string; locale?: string; timezone?: string };
}) {
  const date = (s?: number) => (s ? formatDate(new Date(s * 1000), dateParams) : "—");
  const link = (u?: string) =>
    u ? <a href={u} target="_blank" rel="noreferrer" className="mono">{u}</a> : <span className="secondary">—</span>;

  return (
    <section className="api-details">
      <div className="api-details-head">
        <Img icon={ext.icon} large />
        <div>
          <div className="primary-text" style={{ fontSize: 16 }}>{ext.name}</div>
          <div className="tertiary-text">{t("ext.apiReadOnly")}</div>
        </div>
      </div>
      <dl className="kv api-kv">
        <dt>id</dt>
        <dd className="mono">{ext.id}</dd>
        <dt>name</dt>
        <dd>{ext.name}</dd>
        <dt>url</dt>
        <dd>{link(ext.url)}</dd>
        <dt>test_url</dt>
        <dd>{link(ext.test_url)}</dd>
        <dt>creation_date</dt>
        <dd>{date(ext.creation_date)}</dd>
        <dt>last_update</dt>
        <dd>{date(ext.last_update)}</dd>
      </dl>

      <div className="field-label" style={{ margin: "12px 0 6px" }}>injection_points ({ext.injection_points?.length ?? 0})</div>
      <table className="table compact">
        <thead>
          <tr>
            <th>icon</th>
            <th>anchor</th>
            <th>name</th>
            <th>slug</th>
            <th>path</th>
          </tr>
        </thead>
        <tbody>
          {(ext.injection_points ?? []).map((p, i) => (
            <tr key={`${p.anchor}-${i}`}>
              <td><Img icon={p.icon} /></td>
              <td><span className="tag">{p.anchor}</span></td>
              <td>{p.name ?? "—"}</td>
              <td className="mono">{p.slug ?? "—"}</td>
              <td className="mono">{p.path ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="raw-json">
        <summary>{t("ext.rawJson")}</summary>
        <Payload
          title="GET /extensions/{id}"
          raw={JSON.stringify({ extension: withoutImages(ext) })}
          copyLabel={t("calls.copy")}
          copiedLabel={t("calls.copied")}
        />
      </details>
    </section>
  );
}
