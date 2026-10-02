"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CONTEXT_KEYS } from "@/lib/context";

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
        .catch(() => setVerify({ status: "invalid", reason: "Vérification impossible" }));
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

  const badge = !inIframe
    ? { cls: "off", label: "Hors OneStock" }
    : !verify || verify.status === "pending"
      ? { cls: "off", label: shared ? "Vérification…" : "En attente du contexte…" }
      : verify.status === "valid"
        ? { cls: "on", label: "Signature valide" }
        : verify.status === "not_configured"
          ? { cls: "off", label: "Signature non vérifiée (EXTENSION_SECRETS absent)" }
          : { cls: "err", label: `Signature invalide : ${verify.reason}` };

  return (
    <details className="card context">
      <summary className="row">
        <strong>Contexte</strong>
        <span>
          Site : <span className="mono">{siteId ?? "—"}</span>
        </span>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </summary>

      {!siteId && (
        <form
          className="row"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!siteInput.trim()) return;
            const next = new URLSearchParams(params);
            next.set("site_id", siteInput.trim());
            router.push(`${pathname}?${next}`);
          }}
        >
          <input value={siteInput} onChange={(e) => setSiteInput(e.target.value)} placeholder="site_id" />
          <button type="submit">Choisir le site</button>
        </form>
      )}

      <div className="ctx-grid">
        <div>
          <h3>Paramètres d&apos;URL</h3>
          {urlContext.length ? (
            <dl>
              {urlContext.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className="mono">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="sub">Aucun paramètre.</p>
          )}
        </div>
        <div>
          <h3>Données onestock_data</h3>
          {shared ? (
            <pre className="mono">{JSON.stringify(shared, null, 2)}</pre>
          ) : (
            <p className="sub">{inIframe ? "En attente…" : "Page ouverte hors de OneStock."}</p>
          )}
        </div>
      </div>
    </details>
  );
}
