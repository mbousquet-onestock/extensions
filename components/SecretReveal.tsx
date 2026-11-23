"use client";

import { useState, useTransition } from "react";
import { revealExtensionSecretAction } from "@/app/actions";

type Labels = { show: string; hide: string; copy: string; copied: string; notFound: string; noCredentials: string };

/** Secret hash d'une extension : masqué, affiché à la demande (lu côté serveur), copiable. */
export default function SecretReveal({
  ctx,
  labels,
}: {
  ctx: { site_id?: string; parent_url?: string; api_url?: string; os_id: string };
  labels: Labels;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const show = () =>
    start(async () => {
      setError(null);
      const res = await revealExtensionSecretAction(ctx);
      if ("secret" in res) setSecret(res.secret);
      else setError(res.error === "not_found" ? labels.notFound : res.error === "no_credentials" ? labels.noCredentials : res.error);
    });

  return (
    <span className="secret-reveal">
      <span className="mono">{secret ?? "••••••••"}</span>
      {secret ? (
        <>
          <button
            type="button"
            className="btn btn-tertiary btn-small"
            onClick={() => {
              void navigator.clipboard?.writeText(secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? labels.copied : labels.copy}
          </button>
          <button type="button" className="btn btn-tertiary btn-small" onClick={() => setSecret(null)}>
            {labels.hide}
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-tertiary btn-small" onClick={show} disabled={pending}>
          {labels.show}
        </button>
      )}
      {error && <span className="secret-error">{error}</span>}
    </span>
  );
}
