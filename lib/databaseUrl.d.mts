export const DATABASE_URL_VARS: string[];
export function isPostgresUrl(value: unknown): boolean;
export function databaseUrl(env?: Record<string, string | undefined>): string;
