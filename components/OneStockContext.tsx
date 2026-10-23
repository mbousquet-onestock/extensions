"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CONTEXT_KEYS } from "@/lib/context";
import { getT, resolveLang } from "@/lib/i18n";
import { Icon } from "@/components/ui";

type Shared = Record<string, unknown>;

const SECRET = /token|secret|password|passwd|api_?key|credential/i;

/** Masque les valeurs sensibles avant affichage (aucun caractère conservé). */
function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET.test(k) && v != null && typeof v !== "object" ? "••••••••" : maskSecrets(v)]),
    );
  }
  return value;
}

function parentOrigin(parentUrl: string | null) {
  try {
    if (parentUrl) return new URL(parentUrl).origin;
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {}
  return null;
}

/**
 * Récupère le contexte OneStock : paramètres d'URL de l'iframe, puis handshake
 * `extension_ready` → `onestock_data` (site, URL de l'API…).
 */
export default function OneStockContext() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [shared, setShared] = useState<Shared | null>(null);
  const [siteInput, setSiteInput] = useState("");
  const lang = params.get("lang");
  const t = getT(lang);

  useEffect(() => {
    document.documentElement.lang = resolveLang(lang);
  }, [lang]);

  const inIframe = typeof window !== "undefined" && window.parent !== window;
  const parentUrl = params.get("parent_url");

  useEffect(() => {
    if (window.parent === window) return;
    const origin = parentOrigin(parentUrl);

    const onMessage = (event: MessageEvent) => {
      if (origin && event.origin !== origin) return;
      if (event.data?.type !== "onestock_data") return;
      const data = (event.data.data ?? {}) as Shared;
      setShared(data);

      // Complète l'URL avec ce que fournit le handshake : le site s'il manquait et l'URL de l'API
      // (api_url, utilisée côté serveur pour les appels OneStock).
      const next = new URLSearchParams(params);
      const site = data.site_id ?? data.siteId;
      if (!params.get("site_id") && typeof site === "string" && site) next.set("site_id", site);
      const apiUrl = data.api_url ?? data.apiUrl;
      if (typeof apiUrl === "string" && apiUrl && params.get("api_url") !== apiUrl) next.set("api_url", apiUrl);
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next}`);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "extension_ready" }, origin ?? "*");

    // Ajuste la hauteur de l'iframe au contenu.
    const resize = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: "extension_resize", height: document.documentElement.scrollHeight },
        origin ?? "*",
      );
    });
    resize.observe(document.body);

    return () => {
      window.removeEventListener("message", onMessage);
      resize.disconnect();
    };
    // Le handshake n'a lieu qu'une fois par chargement de l'iframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urlContext = CONTEXT_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)!]);
  const siteId = params.get("site_id");
  const [open, setOpen] = useState(false);

  const items: [string, string | null][] = [
    [t("ctx.user"), params.get("user_id")],
    [t("ctx.app"), params.get("host_app")],
    [t("ctx.lang"), lang],
  ];

  return (
    <>
      <div className="context-bar">
        <span className="item">
          <Icon name="store" />
          {t("ctx.site")}
          {siteId ? (
            <span className="tag">{siteId}</span>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!siteInput.trim()) return;
                const next = new URLSearchParams(params);
                next.set("site_id", siteInput.trim());
                router.push(`${pathname}?${next}`);
              }}
            >
              <input
                className="input btn-small"
                style={{ height: 28, width: 140 }}
                value={siteInput}
                onChange={(e) => setSiteInput(e.target.value)}
                placeholder="site_id"
                aria-label="site_id"
              />
              <button className="btn btn-primary btn-small" type="submit">{t("ctx.chooseSite")}</button>
            </form>
          )}
        </span>
        {items
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <span className="item" key={label}>
              {label} <strong>{v}</strong>
            </span>
          ))}
        <span className="spacer" />
        <button className="btn btn-tertiary btn-small" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {t("ctx.details")}
          <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : undefined }}>
            <Icon name="chevronDown" />
          </span>
        </button>
      </div>

      {open && (
        <div className="context-panel">
          <div>
            <h3>{t("ctx.urlParams")}</h3>
            {urlContext.length ? (
              <dl className="kv">
                {urlContext.map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt className="mono">{k}</dt>
                    <dd className="mono">{SECRET.test(k) ? "••••••••" : v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="secondary">{t("ctx.noParams")}</p>
            )}
          </div>
          <div>
            <h3>{t("ctx.sharedData")}</h3>
            {shared ? (
              <pre className="code">{JSON.stringify(maskSecrets(shared), null, 2)}</pre>
            ) : (
              <p className="secondary">{inIframe ? t("ctx.pending") : t("ctx.openedOutside")}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
