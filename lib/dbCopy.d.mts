// Types du moteur de copie (lib/dbCopy.mjs), utilisé par l'application et par scripts/copy-db.mjs.

export type CopyPlanItem = { table: string; rows: number; inTarget: boolean; targetRows: number | null };
export type CopyResult = {
  table: string;
  rows: number;
  copied: number;
  created: boolean;
  computed: string[];
  missing: string[];
};

export function describeUrl(url: string): string;

export function analyzeCopy(options: {
  sourceUrl: string;
  targetUrl: string;
  schema?: string;
  tables?: string[];
}): Promise<{ source: string; target: string; available: string[]; plan: CopyPlanItem[] }>;

export function runCopy(options: {
  sourceUrl: string;
  targetUrl: string;
  schema?: string;
  tables?: string[];
  mode?: "replace" | "append";
  create?: boolean;
  log?: (line: string) => void;
}): Promise<{ source: string; target: string; mode: string; results: CopyResult[]; durationMs: number }>;
