// Choix de l'URL de connexion de la base de l'application parmi les variables créées par Vercel
// quand une base Neon est reliée au projet. Partagé par l'application et les scripts (migrate, encrypt-secrets).

/** Variables essayées, dans l'ordre ; la première qui contient une vraie URL Postgres est retenue. */
export const DATABASE_URL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
];

export const isPostgresUrl = (value) => {
  if (typeof value !== "string" || !/^postgres(ql)?:\/\//i.test(value.trim())) return false;
  try {
    return !!new URL(value.trim()).hostname;
  } catch {
    return false;
  }
};

/**
 * URL de la base de l'application. Une variable présente mais qui ne contient pas d'URL Postgres
 * (ex. « marketplace ») est ignorée ; si aucune ne convient, l'erreur nomme les variables vérifiées.
 */
export function databaseUrl(env = process.env) {
  for (const name of DATABASE_URL_VARS) {
    if (isPostgresUrl(env[name])) return env[name].trim();
  }
  const invalid = DATABASE_URL_VARS.filter((n) => env[n]);
  throw new Error(
    invalid.length
      ? `Aucune URL de base valide : ${invalid.join(", ")} ne contien${invalid.length > 1 ? "nent" : "t"} pas d'URL postgresql://… ` +
          `(variables vérifiées : ${DATABASE_URL_VARS.join(", ")}). Vérifiez leur valeur dans Vercel → Settings → Environment Variables.`
      : `Aucune base reliée : définissez DATABASE_URL (ou reliez la base au projet dans Vercel → Storage → Connect Project).`,
  );
}
