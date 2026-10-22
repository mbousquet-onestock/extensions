// Moteur de copie d'une base Postgres (Neon / Vercel) vers une autre.
// Partagé par le script `npm run db:copy` et l'onglet « Copie de base » de l'application.
//
// - Toute l'écriture se fait dans une seule transaction côté cible : en cas d'erreur, la cible est inchangée.
// - La source est lue dans un instantané cohérent (REPEATABLE READ).
// - Les tables absentes de la cible sont créées à l'identique (colonnes, défauts, colonnes générées,
//   identités, clés, contraintes, index, clés étrangères).
import pg from "pg";

const CHUNK = 500;

const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

/** Hôte et nom de la base d'une URL de connexion, sans identifiants. */
export function describeUrl(url) {
  const u = new URL(url);
  return `${u.hostname}/${u.pathname.slice(1) || "postgres"}`;
}

function connect(url) {
  const client = new pg.Client({ connectionString: url, statement_timeout: 120000 });
  return client.connect().then(() => client);
}

function helpers(schema) {
  const qualified = (t) => `${q(schema)}.${q(t)}`;

  async function listTables(db) {
    const { rows } = await db.query(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') ORDER BY 1`,
      [schema],
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
      [schema, table, qualified(table)],
    );
    return rows.map((r) => r.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS "));
  }

  const sequenceOf = (expr) => expr?.match(/nextval\('([^']+)'::regclass\)/)?.[1];
  const tableName = (ref) => ref.replace(/^.*\./, "").replace(/"/g, "");

  /** CREATE TABLE à l'identique ; les clés étrangères sont ajoutées après la copie des données. */
  async function createStatements(source, table) {
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
      create: [
        ...before,
        `CREATE TABLE ${qualified(table)} (\n  ${defs.join(",\n  ")}\n)`,
        ...after,
        ...(await indexes(source, table)),
      ],
      foreignKeys: cons
        .filter((c) => c.type === "f")
        .map((c) => `ALTER TABLE ${qualified(table)} ADD CONSTRAINT ${q(c.name)} ${c.def}`),
    };
  }

  /** Ordre de copie : tables référencées (clés étrangères) avant celles qui les référencent. */
  async function copyOrder(source, tables) {
    const deps = new Map();
    for (const t of tables) {
      const cons = await constraints(source, t);
      deps.set(t, cons.filter((c) => c.type === "f").map((c) => tableName(c.references)));
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

  return { qualified, listTables, columns, createStatements, copyOrder, sequenceOf };
}

function checkUrls(sourceUrl, targetUrl) {
  if (!sourceUrl || !targetUrl) throw new Error("La source et la cible sont obligatoires.");
  if (describeUrl(sourceUrl) === describeUrl(targetUrl)) throw new Error("La source et la cible sont la même base.");
}

/**
 * Plan de copie, sans rien écrire : tables de la source (toutes ou `tables`) dans l'ordre de copie,
 * avec leur nombre de lignes et leur état dans la cible.
 */
export async function analyzeCopy({ sourceUrl, targetUrl, schema = "public", tables }) {
  checkUrls(sourceUrl, targetUrl);
  const h = helpers(schema);
  const [source, target] = await Promise.all([connect(sourceUrl), connect(targetUrl)]);
  try {
    const available = await h.listTables(source);
    const wanted = tables?.length ? tables : available;
    const unknown = wanted.filter((t) => !available.includes(t));
    if (unknown.length) throw new Error(`Table(s) absente(s) de la source : ${unknown.join(", ")}`);
    const existing = await h.listTables(target);
    const plan = [];
    for (const t of await h.copyOrder(source, wanted)) {
      const rows = Number((await source.query(`SELECT count(*)::bigint AS n FROM ${h.qualified(t)}`)).rows[0].n);
      const inTarget = existing.includes(t);
      const targetRows = inTarget
        ? Number((await target.query(`SELECT count(*)::bigint AS n FROM ${h.qualified(t)}`)).rows[0].n)
        : null;
      plan.push({ table: t, rows, inTarget, targetRows });
    }
    return { source: describeUrl(sourceUrl), target: describeUrl(targetUrl), available, plan };
  } finally {
    await Promise.all([source.end(), target.end()]).catch(() => {});
  }
}

/**
 * Copie les tables (toutes ou `tables`) de la source vers la cible.
 * mode « replace » : vide les tables existantes de la cible puis les remplit ;
 * mode « append » : ajoute les lignes, garde celles déjà présentes (même clé).
 * `log` reçoit la progression ligne à ligne. Renvoie le détail par table.
 */
export async function runCopy({ sourceUrl, targetUrl, schema = "public", tables, mode = "replace", create = true, log = () => {} }) {
  checkUrls(sourceUrl, targetUrl);
  if (!["replace", "append"].includes(mode)) throw new Error(`Mode inconnu : ${mode}`);
  const h = helpers(schema);
  const started = Date.now();
  const [source, target] = await Promise.all([connect(sourceUrl), connect(targetUrl)]);
  const results = [];
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const available = await h.listTables(source);
    const wanted = tables?.length ? tables : available;
    const unknown = wanted.filter((t) => !available.includes(t));
    if (unknown.length) throw new Error(`Table(s) absente(s) de la source : ${unknown.join(", ")}`);
    const existing = await h.listTables(target);
    const todo = (await h.copyOrder(source, wanted)).filter((t) => existing.includes(t) || create);

    await target.query("BEGIN");
    try {
      const foreignKeys = [];
      for (const t of todo.filter((t) => !existing.includes(t))) {
        const ddl = await h.createStatements(source, t);
        for (const stmt of ddl.create) await target.query(stmt);
        foreignKeys.push(...ddl.foreignKeys);
        log(`+ table ${t} créée`);
      }
      if (mode === "replace") {
        const toEmpty = todo.filter((t) => existing.includes(t)).map(h.qualified);
        if (toEmpty.length) await target.query(`TRUNCATE ${toEmpty.join(", ")}`);
      }

      for (const t of todo) {
        const srcCols = await h.columns(source, t);
        const tgtCols = await h.columns(target, t);
        // Colonnes communes, hors colonnes générées (calculées par la base cible).
        const cols = srcCols
          .filter((c) => !c.generated && tgtCols.some((x) => x.name === c.name && !x.generated))
          .map((c) => c.name);
        const notCopied = srcCols.filter((c) => !c.generated && !cols.includes(c.name));
        const computed = notCopied.filter((c) => tgtCols.some((x) => x.name === c.name && x.generated)).map((c) => c.name);
        const missing = notCopied.filter((c) => !tgtCols.some((x) => x.name === c.name)).map((c) => c.name);
        if (computed.length) log(`· ${t} : colonne(s) calculée(s) par la cible : ${computed.join(", ")}`);
        if (missing.length) log(`! ${t} : colonne(s) absente(s) de la cible, non copiée(s) : ${missing.join(", ")}`);

        const overriding = tgtCols.some((c) => c.identity === "a" && cols.includes(c.name)) ? "OVERRIDING SYSTEM VALUE" : "";
        const list = cols.map(q).join(", ");
        const total = Number((await source.query(`SELECT count(*)::bigint AS n FROM ${h.qualified(t)}`)).rows[0].n);
        let copied = 0;
        for (let offset = 0; offset < total; offset += CHUNK) {
          const { rows } = await source.query(
            `SELECT coalesce(json_agg(x), '[]') AS data FROM (
               SELECT ${list} FROM ${h.qualified(t)} ORDER BY ctid LIMIT ${CHUNK} OFFSET ${offset}) x`,
          );
          const res = await target.query(
            `INSERT INTO ${h.qualified(t)} (${list}) ${overriding}
             SELECT ${list} FROM json_populate_recordset(null::${h.qualified(t)}, $1::json)
             ${mode === "append" ? "ON CONFLICT DO NOTHING" : ""}`,
            [JSON.stringify(rows[0].data)],
          );
          copied += res.rowCount;
        }

        // Recale les séquences (serial / identity) sur la valeur maximale copiée.
        for (const c of tgtCols.filter((c) => cols.includes(c.name) && (c.identity || h.sequenceOf(c.expr)))) {
          await target.query(
            `SELECT setval(pg_get_serial_sequence($1, $2), coalesce(max(${q(c.name)}), 1), max(${q(c.name)}) IS NOT NULL)
             FROM ${h.qualified(t)}`,
            [h.qualified(t), c.name],
          );
        }
        results.push({ table: t, rows: total, copied, created: !existing.includes(t), computed, missing });
        log(`✔ ${t} : ${copied} ligne(s) copiée(s)${mode === "append" && copied < total ? ` (${total - copied} déjà présente(s))` : ""}`);
      }

      for (const fk of foreignKeys) await target.query(fk);
      await target.query("COMMIT");
    } catch (e) {
      await target.query("ROLLBACK").catch(() => {});
      throw e;
    }
    return { source: describeUrl(sourceUrl), target: describeUrl(targetUrl), mode, results, durationMs: Date.now() - started };
  } finally {
    await Promise.all([source.end(), target.end()]).catch(() => {});
  }
}
