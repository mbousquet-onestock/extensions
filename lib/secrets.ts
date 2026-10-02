import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Settings sensibles (onestock_token, secrets, mots de passe…) : chiffrés en base, jamais affichés.
export const SECRET_KEY = /token|secret|password|passwd|api_?key|credential/i;
export const isSecretKey = (key: string) => SECRET_KEY.test(key);

const PREFIX = "enc:v1:";
export const isEncrypted = (value: string | null | undefined) => !!value?.startsWith(PREFIX);

export class MissingKeyError extends Error {
  constructor() {
    super("SETTINGS_ENCRYPTION_KEY is not set");
  }
}

/** Clé AES-256 : 64 caractères hexadécimaux, 32 octets en base64, ou une phrase secrète (hachée en SHA-256). */
function key() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) throw new MissingKeyError();
  if (/^[\da-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(raw)) return b64;
  return createHash("sha256").update(raw).digest();
}

export const hasEncryptionKey = () => !!process.env.SETTINGS_ENCRYPTION_KEY?.trim();

/** AES-256-GCM → `enc:v1:<base64(iv | tag | texte chiffré)>`. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** Déchiffre une valeur `enc:v1:` ; une ancienne valeur en clair est renvoyée telle quelle. */
export function decryptSecret(value: string) {
  if (!isEncrypted(value)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
