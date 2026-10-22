// Copie les tables d'une base Postgres (Neon / Vercel) vers une autre.
// Même moteur que l'onglet « Copie de base » de l'application (lib/dbCopy.mjs).
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
import { analyzeCopy, runCopy } from "../lib/dbCopy.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const options = {
  sourceUrl: process.env.SOURCE_DATABASE_URL,
  targetUrl: process.env.TARGET_DATABASE_URL,
  schema: args.schema ?? "public",
  tables: args.tables ? String(args.tables).split(",").map((t) => t.trim()).filter(Boolean) : undefined,
};
const MODE = args.mode ?? "replace";
const CREATE = !args["no-create"];

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!options.sourceUrl || !options.targetUrl) fail("SOURCE_DATABASE_URL et TARGET_DATABASE_URL sont obligatoires.");
  if (!["replace", "append"].includes(MODE)) fail(`--mode inconnu : ${MODE} (replace | append)`);

  const { source, target, plan } = await analyzeCopy(options);
  console.log(`\nSource : ${source}\nCible  : ${target}\nMode   : ${MODE}${args["dry-run"] ? " (simulation)" : ""}\n`);
  for (const p of plan) {
    const action = !p.inTarget
      ? CREATE ? "table créée" : "ABSENTE de la cible, ignorée"
      : MODE === "replace" ? `${p.targetRows} ligne(s) remplacée(s)` : `${p.targetRows} ligne(s) conservée(s)`;
    console.log(`  ${p.table.padEnd(28)} ${String(p.rows).padStart(8)} ligne(s)  → ${action}`);
  }
  if (!plan.some((p) => p.inTarget || CREATE)) fail("Rien à copier.");
  if (args["dry-run"]) return console.log("\nSimulation : rien n'a été écrit.");

  if (!args.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `\n${MODE === "replace" ? "Les tables existantes de la cible seront VIDÉES puis remplies. " : ""}Tapez COPIER pour continuer : `,
    );
    rl.close();
    if (answer.trim() !== "COPIER") fail("Annulé.");
  }

  try {
    const res = await runCopy({ ...options, mode: MODE, create: CREATE, log: (l) => console.log(`  ${l}`) });
    console.log(`\nCopie terminée en ${(res.durationMs / 1000).toFixed(1)} s.`);
  } catch (e) {
    fail(`Erreur, la cible est inchangée : ${e.message}`);
  }
}

main().catch((e) => fail(e.message));
