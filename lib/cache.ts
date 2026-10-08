import { revalidateTag, updateTag } from "next/cache";

// Étiquettes du cache de données (unstable_cache) et invalidation après une modification.

/** Lignes de la table settings utilisées pour les identifiants OneStock. */
export const SETTINGS_TAG = "settings";
/** Réponses de l'API OneStock pour un site (extensions installées, détails). */
export const onestockTag = (siteId: string) => `onestock:${siteId}`;

/** Depuis une action serveur : la page suivante relit immédiatement les données à jour. */
export function invalidateNow(...tags: string[]) {
  for (const tag of tags) updateTag(tag);
}

/** Depuis une route API (hors action serveur) : expiration immédiate. */
export function invalidateFromRoute(...tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
