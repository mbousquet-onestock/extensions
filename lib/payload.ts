// Analyse des payloads (requête, réponse, erreur) pour un affichage lisible. Fonctions pures, client et serveur.

export type Parsed =
  | { kind: "empty" }
  | { kind: "json"; value: unknown }
  | { kind: "text"; text: string }
  /** Texte suivi d'un JSON, ex. `OneStock API answered HTTP 401: {"error":"auth_error"}` */
  | { kind: "mixed"; text: string; value: unknown };

function tryJson(s: string): { ok: true; value: unknown } | { ok: false } {
  const t = s.trim();
  if (!t || !"{[".includes(t[0])) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    return { ok: false };
  }
}

export function parsePayload(raw: string | null | undefined): Parsed {
  if (raw === null || raw === undefined || raw.trim() === "") return { kind: "empty" };
  const whole = tryJson(raw);
  if (whole.ok) return { kind: "json", value: whole.value };

  // Cherche un JSON en fin de texte.
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "{" && raw[i] !== "[") continue;
    const tail = tryJson(raw.slice(i));
    if (tail.ok) {
      const text = raw.slice(0, i).trim().replace(/[:\-–]\s*$/, "").trim();
      return text ? { kind: "mixed", text, value: tail.value } : { kind: "json", value: tail.value };
    }
  }
  return { kind: "text", text: raw };
}

export const isPrimitive = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);

/** Objet « plat » (valeurs simples uniquement) : affiché en tableau clé / valeur. */
export function isFlatObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const values = Object.values(v);
  return values.length > 0 && values.length <= 40 && values.every(isPrimitive);
}

const MESSAGE_KEYS = ["message", "error_description", "detail", "description", "title", "error"];

/** Résumé d'une erreur sur une ligne : `401 · auth_error — the token is expired or invalid`. */
export function summarizeError(raw: string): string {
  const p = parsePayload(raw);
  if (p.kind === "text") return p.text.replace(/\s+/g, " ");
  if (p.kind === "empty") return "";
  const obj = p.value && typeof p.value === "object" && !Array.isArray(p.value) ? (p.value as Record<string, unknown>) : null;
  const http = p.kind === "mixed" ? p.text.match(/\b(?:HTTP|status)\s*(\d{3})\b/i)?.[1] : undefined;
  const code = obj && typeof obj.error === "string" ? obj.error : obj && typeof obj.code === "string" ? obj.code : undefined;
  const msgKey = obj && MESSAGE_KEYS.find((k) => typeof obj[k] === "string" && obj[k] !== code);
  const message = msgKey ? String(obj![msgKey]) : undefined;

  const head = [http, code].filter(Boolean).join(" · ");
  if (head || message) return [head, message].filter(Boolean).join(" — ");
  return (p.kind === "mixed" ? p.text : JSON.stringify(p.value)).replace(/\s+/g, " ");
}
