"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CONTEXT_KEYS } from "@/lib/context";
import { getT, resolveLang, type MessageKey } from "@/lib/i18n";
import { Icon } from "@/components/ui";

type Shared = Record<string, unknown>;
type Verify = { status: "valid" | "invalid" | "not_configured" | "pending"; reason?: string };

function parentOrigin(parentUrl: string | null) {
  try {
    if (parentUrl) return new URL(parentUrl).origin;
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {}
  return null;
}

/**
 * Récupère le contexte OneStock : paramètres d'URL de l'iframe, puis handshake
 * `extension_ready` → `onestock_data`, et vérifie la signature côté serveur.
 */
export default function OneStockContext() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [shared, setShared] = useState<Shared | null>(null);
  const [verify, setVerify] = useState<Verify | null>(null);
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

      // Complète l'URL si le site n'y figurait pas mais est fourni par le handshake.
      const site = data.site_id ?? data.siteId;
      if (!params.get("site_id") && typeof site === "string" && site) {
        const next = new URLSearchParams(params);
        next.set("site_id", site);
        router.replace(`${pathname}?${next}`);
      }

      setVerify({ status: "pending" });
      fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          extension_signature: data.extension_signature,
          extension_id: data.extension_id ?? params.get("extension_id"),
          user_id: data.user_id ?? params.get("user_id"),
        }),
      })
        .then((r) => r.json())
        .then(setVerify)
        .catch(() => setVerify({ status: "invalid", reason: "failed" }));
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

  const badge = !inIframe
    ? { cls: "badge-grey", label: t("ctx.outside") }
    : !verify || verify.status === "pending"
      ? { cls: "badge-grey", label: shared ? t("ctx.verifying") : t("ctx.waiting") }
      : verify.status === "valid"
        ? { cls: "badge-green", label: t("ctx.valid") }
        : verify.status === "not_configured"
          ? { cls: "badge-orange", label: t("ctx.notConfigured") }
          : {
              cls: "badge-red",
              label: t("ctx.invalid", {
                reason: verify.reason === "failed" ? t("ctx.verifyFailed") : t(`ctx.reason.${verify.reason}` as MessageKey),
              }),
            };

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
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
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
                    <dd className="mono">{v}</dd>
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
              <pre className="code">{JSON.stringify(shared, null, 2)}</pre>
            ) : (
              <p className="secondary">{inIframe ? t("ctx.pending") : t("ctx.openedOutside")}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
