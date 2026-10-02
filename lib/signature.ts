import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type SignatureResult =
  | { status: "valid" }
  | { status: "invalid"; reason: string }
  | { status: "not_configured" };

/**
 * Vérifie `extension_signature` (format `t=timestamp,h0=…,h1=…,h2=…`) :
 * HMAC-SHA256 en hex de `${t}.${extension_id}##${user_id}` avec l'une des clés secrètes.
 */
export function checkExtensionSignature(
  signature: string,
  extensionId: string,
  userId: string,
  secrets = (process.env.EXTENSION_SECRETS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  now = Date.now(),
): SignatureResult {
  if (secrets.length === 0) return { status: "not_configured" };
  if (!signature) return { status: "invalid", reason: "Signature absente" };

  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t)) return { status: "invalid", reason: "Horodatage manquant" };
  const tMs = t > 1e12 ? t : t * 1000;
  if (Math.abs(now - tMs) > MAX_AGE_MS) return { status: "invalid", reason: "Signature expirée (> 6 h)" };

  const hashes = Object.entries(parts)
    .filter(([k, v]) => /^h\d+$/.test(k) && v)
    .map(([, v]) => Buffer.from(v, "hex"));
  const message = `${parts.t}.${extensionId}##${userId}`;

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(message).digest();
    if (hashes.some((h) => h.length === expected.length && timingSafeEqual(h, expected))) {
      return { status: "valid" };
    }
  }
  return { status: "invalid", reason: "Signature non reconnue" };
}
