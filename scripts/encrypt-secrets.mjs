// Chiffre (AES-256-GCM) les valeurs sensibles de la table settings encore stockées en clair.
// Usage : DATABASE_URL=… SETTINGS_ENCRYPTION_KEY=… npm run secrets:encrypt
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
if (!url || !raw) {
  console.error("DATABASE_URL (ou POSTGRES_URL) et SETTINGS_ENCRYPTION_KEY sont obligatoires.");
  process.exit(1);
}

// Même dérivation de clé que lib/secrets.ts.
const b64 = Buffer.from(raw, "base64");
const key = /^[\da-f]{64}$/i.test(raw)
  ? Buffer.from(raw, "hex")
  : b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(raw)
    ? b64
    : createHash("sha256").update(raw).digest();

function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "enc:v1:" + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

const sql = neon(url);
const rows = await sql`
  SELECT key, value, site_id, extension_id, environment FROM settings
  WHERE key ~* '(token|secret|password|passwd|api_?key|credential)'
    AND value IS NOT NULL AND value <> '' AND value NOT LIKE 'enc:v1:%'`;

for (const r of rows) {
  await sql`
    UPDATE settings SET value = ${encrypt(r.value)}, updated_at = now()
    WHERE key = ${r.key} AND site_id = ${r.site_id} AND extension_id = ${r.extension_id}
      AND environment = ${r.environment} AND value = ${r.value}`;
  console.log(`chiffré : ${r.key} (site ${r.site_id || "*"}, ${r.environment})`);
}
console.log(`${rows.length} valeur(s) chiffrée(s).`);
