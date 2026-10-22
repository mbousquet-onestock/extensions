// Copie les tables d'une base Postgres (Neon / Vercel) vers une autre.
//
// Usage :
//   SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… npm run db:copy -- [options]
//
// Options :
//   --tables=settings,extensions   tables à copier (défaut : toutes les tables du schéma)
//   --schema=public                schéma (défaut : public)
//   --mode=replace                 replace : vide les tables cibles puis copie (défaut)
//                                  append  : ajoute les lignes, ignore celles qui existent déjà (même clé)
//   --no-create                    ne crée pas les tables absentes de la cible (sinon : créées à l'identique)
//   --dry-run                      affiche ce qui serait copié, sans rien écrire
//   --yes                          ne demande pas de confirmation
//
// Toute la copie se fait dans une seule transaction côté cible : en cas d'erreur, la cible est inchangée.
// Utiliser les URL de connexion directes (sans « -pooler » dans l'hôte).
import readline from "node:readline/promises";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;
const SCHEMA = args.schema ?? "public";
const MODE = args.mode ?? "replace";
const CREATE = !args["no-create"];
const DRY = !!args["dry-run"];
const CHUNK = 500;

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}
if (!SOURCE || !TARGET) fail("SOURCE_DATABASE_URL et TARGET_DATABASE_URL sont obligatoires.");
if (!["replace", "append"].includes(MODE)) fail(`--mode inconnu : ${MODE} (replace | append)`);

const describe = (url) => {
  const u = new URL(url);
  return `${u.hostname}/${u.pathname.slice(1) || "postgres"}`;
};
if (describe(SOURCE) === describe(TARGET)) fail("La source et la cible sont la même base.");

const q = (id) => `"${String(id).replace(/"/g, '""')}"`;
const qualified = (t) => `${q(SCHEMA)}.${q(t)}`;

const source = new pg.Client({ connectionString: SOURCE });
const target = new pg.Client({ connectionString: TARGET });

// ---------- Lecture de la structure ----------

async function listTables(db) {
  const { rows } = await db.query(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') ORDER BY 1`,
    [SCHEMA],
  );
  return rows.map((r) => r.name);
}

async function columns(db, table) {
  const { rows } = await db.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
            a.attgenerated AS generated, a.attidentity AS identity, pg_get_expr(d.adbin, d.adrelid) AS expr
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = to_regclass($1) AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [qualified(table)],
  );
  return rows;
}

async function constraints(db, table) {
  const { rows } = await db.query(
    `SELECT conname AS name, contype AS type, pg_get_constraintdef(oid) AS def,
            confrelid::regclass::text AS references
     FROM pg_constraint WHERE conrelid = to_regclass($1) ORDER BY contype, conname`,
    [qualified(table)],
  );
  return rows;
}

async function indexes(db, table) {
  const { rows } = await db.query(
    `SELECT indexdef FROM pg_indexes i
     WHERE schemaname = $1 AND tablename = $2
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = i.indexname AND c.conrelid = to_regclass($3))`,
    [SCHEMA, table, qualified(table)],
  );
  return rows.map((r) => r.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS "));
}

const sequenceOf = (expr) => expr?.match(/nextval\('([^']+)'::regclass\)/)?.[1];

/** CREATE TABLE à l'identique (colonnes, défauts, colonnes générées, identité, clés, index ; FK à la fin). */
async function createStatements(table) {
  const cols = await columns(source, table);
  const cons = await constraints(source, table);
  const before = [];
  const defs = cols.map((c) => {
    let def = `${q(c.name)} ${c.type}`;
    if (c.generated === "s") def += ` GENERATED ALWAYS AS (${c.expr}) STORED`;
    else if (c.identity) def += ` GENERATED ${c.identity === "a" ? "ALWAYS" : "BY DEFAULT"} AS IDENTITY`;
    else if (c.expr) {
      const seq = sequenceOf(c.expr);
      if (seq) before.push(`CREATE SEQUENCE IF NOT EXISTS ${seq}`);
      def += ` DEFAULT ${c.expr}`;
    }
    if (c.notnull) def += " NOT NULL";
    return def;
  });
  for (const c of cons.filter((c) => c.type !== "f")) defs.push(`CONSTRAINT ${q(c.name)} ${c.def}`);
  const after = cols
    .filter((c) => sequenceOf(c.expr))
    .map((c) => `ALTER SEQUENCE ${sequenceOf(c.expr)} OWNED BY ${qualified(table)}.${q(c.name)}`);
  return {
    create: [...before, `CREATE TABLE ${qualified(table)} (\n  ${defs.join(",\n  ")}\n)`, ...after, ...(await indexes(source, table))],
    foreignKeys: cons.filter((c) => c.type === "f").map((c) => `ALTER TABLE ${qualified(table)} ADD CONSTRAINT ${q(c.name)} ${c.def}`),
    dependsOn: cons.filter((c) => c.type === "f").map((c) => c.references.replace(/^.*\./, "").replace(/"/g, "")),
  };
}

/** Ordre de copie : tables référencées (clés étrangères) avant celles qui les référencent. */
async function copyOrder(tables) {
  const deps = new Map();
  for (const t of tables) {
    const cons = await constraints(source, t);
    deps.set(t, cons.filter((c) => c.type === "f").map((c) => c.references.replace(/^.*\./, "").replace(/"/g, "")));
  }
  const ordered = [];
  const visit = (t, path = []) => {
    if (ordered.includes(t) || path.includes(t)) return;
    for (const d of deps.get(t) ?? []) if (tables.includes(d)) visit(d, [...path, t]);
    ordered.push(t);
  };
  tables.forEach((t) => visit(t));
  return ordered;
}

// ---------- Copie ----------

async function main() {
  await source.connect();
  await target.connect();
  // Instantané cohérent de la source pendant toute la lecture.
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const available = await listTables(source);
  const wanted = args.tables ? String(args.tables).split(",").map((t) => t.trim()).filter(Boolean) : available;
  const unknown = wanted.filter((t) => !available.includes(t));
  if (unknown.length) fail(`Table(s) absente(s) de la source : ${unknown.join(", ")}`);
  const tables = await copyOrder(wanted);
  const existing = await listTables(target);

  console.log(`\nSource : ${describe(SOURCE)}\nCible  : ${describe(TARGET)}\nMode   : ${MODE}${DRY ? " (simulation)" : ""}\n`);
  const plan = [];
  for (const t of tables) {
    const { rows } = await source.query(`SELECT count(*)::bigint AS n FROM ${qualified(t)}`);
    const inTarget = existing.includes(t);
    const targetCount = inTarget
      ? Number((await target.query(`SELECT count(*)::bigint AS n FROM ${qualified(t)}`)).rows[0].n)
      : null;
    plan.push({ table: t, rows: Number(rows[0].n), inTarget, targetCount });
    const action = !inTarget ? (CREATE ? "table créée" : "ABSENTE de la cible, ignorée") : MODE === "replace" ? `${targetCount} ligne(s) remplacée(s)` : `${targetCount} ligne(s) conservée(s)`;
    console.log(`  ${t.padEnd(28)} ${String(rows[0].n).padStart(8)} ligne(s)  → ${action}`);
  }
  const todo = plan.filter((p) => p.inTarget || CREATE);
  if (todo.length === 0) fail("Rien à copier.");
  if (DRY) {
    console.log("\nSimulation : rien n'a été écrit.");
    return;
  }

  if (!args.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\n${MODE === "replace" ? "Les tables existantes de la cible seront VIDÉES puis remplies. " : ""}Tapez COPIER pour continuer : `);
    rl.close();
    if (answer.trim() !== "COPIER") fail("Annulé.");
  }

  const started = Date.now();
  await target.query("BEGIN");
  try {
    const foreignKeys = [];
    for (const p of todo.filter((p) => !p.inTarget)) {
      const ddl = await createStatements(p.table);
      for (const stmt of ddl.create) await target.query(stmt);
      foreignKeys.push(...ddl.foreignKeys);
      console.log(`  + table ${p.table} créée`);
    }
    if (MODE === "replace") {
      const toEmpty = todo.filter((p) => p.inTarget).map((p) => qualified(p.table));
      if (toEmpty.length) await target.query(`TRUNCATE ${toEmpty.join(", ")}`);
    }

    for (const p of todo) {
      const srcCols = await columns(source, p.table);
      const tgtCols = await columns(target, p.table);
      // Colonnes communes, hors colonnes générées (calculées par la base cible).
      const cols = srcCols
        .filter((c) => !c.generated && tgtCols.some((t) => t.name === c.name && !t.generated))
        .map((c) => c.name);
      const notCopied = srcCols.filter((c) => !c.generated && !cols.includes(c.name));
      const computed = notCopied.filter((c) => tgtCols.some((t) => t.name === c.name && t.generated)).map((c) => c.name);
      const missing = notCopied.filter((c) => !tgtCols.some((t) => t.name === c.name)).map((c) => c.name);
      if (computed.length) console.log(`  · ${p.table} : colonne(s) calculée(s) par la cible : ${computed.join(", ")}`);
      if (missing.length) console.log(`  ! ${p.table} : colonne(s) absente(s) de la cible, non copiée(s) : ${missing.join(", ")}`);
      const overriding = tgtCols.some((c) => c.identity === "a" && cols.includes(c.name)) ? "OVERRIDING SYSTEM VALUE" : "";
      const list = cols.map(q).join(", ");

      let copied = 0;
      for (let offset = 0; offset < p.rows; offset += CHUNK) {
        const { rows } = await source.query(
          `SELECT coalesce(json_agg(x), '[]') AS data FROM (
             SELECT ${list} FROM ${qualified(p.table)} ORDER BY ctid LIMIT ${CHUNK} OFFSET ${offset}) x`,
        );
        const res = await target.query(
          `INSERT INTO ${qualified(p.table)} (${list}) ${overriding}
           SELECT ${list} FROM json_populate_recordset(null::${qualified(p.table)}, $1::json)
           ${MODE === "append" ? "ON CONFLICT DO NOTHING" : ""}`,
          [JSON.stringify(rows[0].data)],
        );
        copied += res.rowCount;
      }

      // Recale les séquences (serial / identity) sur la valeur maximale copiée.
      for (const c of tgtCols.filter((c) => cols.includes(c.name) && (c.identity || sequenceOf(c.expr)))) {
        await target.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), coalesce(max(${q(c.name)}), 1), max(${q(c.name)}) IS NOT NULL)
           FROM ${qualified(p.table)}`,
          [qualified(p.table), c.name],
        );
      }
      console.log(`  ✔ ${p.table} : ${copied} ligne(s) copiée(s)${MODE === "append" && copied < p.rows ? ` (${p.rows - copied} déjà présente(s))` : ""}`);
    }

    for (const fk of foreignKeys) await target.query(fk);
    await target.query("COMMIT");
    console.log(`\nCopie terminée en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  } catch (e) {
    await target.query("ROLLBACK");
    fail(`Erreur, la cible est inchangée : ${e.message}`);
  }
}

main()
  .catch((e) => fail(e.message))
  .finally(async () => {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  });
