import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "../lib/databaseUrl.mjs";

let url;
try {
  url = databaseUrl();
} catch {
  url = undefined;
}
if (!url) {
  console.error("DATABASE_URL (ou POSTGRES_URL) n'est pas défini.");
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Migration terminée (${statements.length} requêtes).`);
