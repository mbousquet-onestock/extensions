// Accès à l'API Neon : liste des bases (par nom) et URL de connexion, pour l'onglet « Copie de base ».
// Clé : NEON_API_KEY (clé d'organisation de préférence ; une clé personnelle peut cibler une organisation
// avec NEON_ORG_ID). Les bases Neon créées depuis Vercel appartiennent à l'organisation Neon liée à Vercel.

const API = (process.env.NEON_API_URL || "https://console.neon.tech/api/v2").replace(/\/+$/, "");

export const neonEnabled = () => !!process.env.NEON_API_KEY?.trim();

export type NeonDatabase = {
  /** Nom affiché et saisi : nom du projet (= nom de la base dans Vercel), précisé si besoin. */
  label: string;
  projectId: string;
  project: string;
  branchId: string;
  branch: string;
  defaultBranch: boolean;
  database: string;
  role: string;
};

async function neon<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.NEON_API_KEY?.trim()}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(`Neon API ${res.status}${body.message ? ` : ${body.message}` : ""}`);
  return body as T;
}

type Project = { id: string; name: string };
type Branch = { id: string; name: string; default?: boolean; primary?: boolean };
type Database = { name: string; owner_name: string };

async function listProjects() {
  const org = process.env.NEON_ORG_ID?.trim();
  const projects: Project[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ limit: "400", ...(org && { org_id: org }), ...(cursor && { cursor }) });
    const res = await neon<{ projects: Project[]; pagination?: { cursor?: string } }>(`/projects?${qs}`);
    projects.push(...res.projects);
    cursor = res.pagination?.cursor;
    if (!cursor || res.projects.length === 0) break;
  }
  return projects;
}

let cache: { at: number; value: Promise<NeonDatabase[]> } | null = null;

/** Toutes les bases accessibles avec la clé (projets → branches → bases), en cache 60 s. */
export function listNeonDatabases(): Promise<NeonDatabase[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const value = (async () => {
    const projects = await listProjects();
    const perProject = await Promise.all(
      projects.map(async (p) => {
        const { branches } = await neon<{ branches: Branch[] }>(`/projects/${encodeURIComponent(p.id)}/branches`);
        const perBranch = await Promise.all(
          branches.map(async (b) => {
            const { databases } = await neon<{ databases: Database[] }>(
              `/projects/${encodeURIComponent(p.id)}/branches/${encodeURIComponent(b.id)}/databases`,
            );
            return databases.map((d) => ({
              projectId: p.id,
              project: p.name,
              branchId: b.id,
              branch: b.name,
              defaultBranch: !!(b.default ?? b.primary),
              database: d.name,
              role: d.owner_name,
            }));
          }),
        );
        return perBranch.flat();
      }),
    );
    return withLabels(perProject.flat());
  })();
  cache = { at: Date.now(), value };
  value.catch(() => (cache = null));
  return value;
}

/**
 * Nom lisible : le nom du projet seul quand il n'a qu'une base sur sa branche par défaut (cas des bases
 * créées depuis Vercel), sinon « projet / base » et « @branche » hors branche par défaut.
 */
function withLabels(dbs: Omit<NeonDatabase, "label">[]): NeonDatabase[] {
  // Nombre de bases sur la branche par défaut de chaque projet (les autres branches sont suffixées « @branche »).
  const perProject = new Map<string, number>();
  for (const d of dbs) if (d.defaultBranch) perProject.set(d.projectId, (perProject.get(d.projectId) ?? 0) + 1);
  const labelled = dbs.map((d) => {
    let label = (perProject.get(d.projectId) ?? 0) <= 1 ? d.project : `${d.project} / ${d.database}`;
    if (!d.defaultBranch) label += ` @${d.branch}`;
    return { ...d, label };
  });
  // Deux projets du même nom : on ajoute l'identifiant du projet.
  const counts = new Map<string, number>();
  for (const d of labelled) counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
  return labelled
    .map((d) => (counts.get(d.label)! > 1 ? { ...d, label: `${d.label} (${d.projectId})` } : d))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export class DatabaseNameError extends Error {
  constructor(readonly code: "not_found" | "ambiguous", readonly detail: string) {
    super(`${code}: ${detail}`);
  }
}

/** Retrouve une base par son nom (nom affiché, puis nom du projet, puis nom de la base) — sans ambiguïté. */
export async function findNeonDatabase(name: string) {
  const all = await listNeonDatabases();
  const n = name.trim().toLowerCase();
  for (const match of [
    (d: NeonDatabase) => d.label.toLowerCase() === n,
    (d: NeonDatabase) => d.project.toLowerCase() === n && d.defaultBranch,
    (d: NeonDatabase) => d.database.toLowerCase() === n && d.defaultBranch,
  ]) {
    const found = all.filter(match);
    if (found.length === 1) return found[0];
    if (found.length > 1) throw new DatabaseNameError("ambiguous", found.map((d) => d.label).join(", "));
  }
  throw new DatabaseNameError("not_found", name);
}

/** URL de connexion directe (sans pooler) d'une base Neon. */
export async function neonConnectionUrl(db: NeonDatabase) {
  const qs = new URLSearchParams({
    branch_id: db.branchId,
    database_name: db.database,
    role_name: db.role,
    pooled: "false",
  });
  const { uri } = await neon<{ uri: string }>(`/projects/${encodeURIComponent(db.projectId)}/connection_uri?${qs}`);
  return uri;
}
