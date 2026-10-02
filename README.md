# Extensions

App Next.js (déployée sur Vercel) chargée en iframe dans OneStock comme UI extension.

- **Contexte** : récupère les paramètres d'URL envoyés par OneStock (`site_id`, `extension_id`, `user_id`, `lang`, `host_app`, `parent_url`, …), fait le handshake `extension_ready` → `onestock_data` par postMessage et vérifie `extension_signature` (HMAC-SHA256 de `${t}.${extension_id}##${user_id}`, valable 6 h) côté serveur. Le contexte est affiché en haut de chaque page et conservé dans les liens. Hors OneStock, on peut saisir un `site_id` à la main.
- **Extensions** (`/`) : les extensions installées sur le `site_id` du contexte viennent de l'API OneStock — `POST {onestock_api_root}/extensions/query` puis `GET {onestock_api_root}/extensions/{id}` (corps `{ site_id, token }`, token = setting global `onestock_token`) : icône, points d'injection, URL de production / test, dernière mise à jour. Elles sont fusionnées avec le catalogue commun en base (créer, modifier, supprimer). Chaque appel est enregistré dans `api_logs` (token masqué, icônes base64 remplacées par un libellé).
- **Settings d'une extension** (`/extensions/<id>/settings`) : lignes de la table `settings` dont `extension_id` est l'id OneStock de l'extension ou le slug d'un de ses points d'injection.
- **Settings généraux** (`/settings`) : lignes de `settings` avec `scope = 'global'` (ou `extension_id = '*'`).

Les settings peuvent être ajoutés et modifiés depuis ces deux pages (en modification, seuls la valeur et le scope changent : `key`, `site_id`, `extension_id` et `environment` forment la clé). Ils sont filtrés sur le `site_id` du contexte ; un `site_id` à `*` ou vide vaut pour tous les sites et est marqué « remplacé » quand une valeur existe pour le site. Filtre par `environment`, valeurs sensibles (token, secret…) masquées.
- **Langue** : les textes de l'interface suivent le paramètre `lang` du contexte (français ou anglais ; une autre langue bascule en anglais, `lang` absent → français). Les dates utilisent `locale` et `timezone` du contexte. Les traductions sont dans `lib/i18n.ts`.
- **Appels API** (`/logs`) : historique de la table `api_logs` (filtré sur le site du contexte si la table a une colonne `site_id`) — filtre par API, « erreurs uniquement », recherche, export CSV et vidage. Un clic sur une ligne affiche la requête et la réponse / l'erreur (bouton copier). Tokens et clés sont masqués à l'affichage et à l'export.

Les colonnes de `api_logs` sont reconnues par leur nom : `created_at`, `api`, `method`, `path` (ou `url`), `status`, `duration_ms`, `result`, `error`, `request`, `response`, `site_id`.

## Interface

L'interface applique le design system OneStock (`@onestock-public/design-system`) : police Roboto, couleur primaire `#24bdb0`, cartes bordées sans ombre, onglets OsTabs, badges teintés, alertes OsAlert. Les tokens et composants CSS sont dans `app/globals.css`, les primitives (icônes, alertes, modale) dans `components/ui.tsx`. Les formulaires de création / modification s'ouvrent dans une modale (fermeture par Échap ou clic à l'extérieur).

## Tables

Créées automatiquement au premier accès (ou via `npm run db:migrate`) :

- `extensions` (`id`, `name`, `installation_point`, `description`)

Table existante utilisée : `settings` (`key`, `value`, `updated_at`, `site_id`, `extension_id`, `environment`, `scope`).

## Configuration

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | Connexion à la base Postgres Vercel (Neon). |
| `EXTENSION_SECRETS` | Clé(s) secrète(s) OneStock pour vérifier la signature, séparées par des virgules. Sans elle, la signature n'est pas vérifiée. |
| `ONESTOCK_ENVIRONMENT` | Optionnel : environnement des settings `onestock_api_root` / `onestock_token` à utiliser (sinon « qualif » si l'URL parente le contient, ou le seul environnement disponible, ou prod). |
| `ONESTOCK_API_VERSION` | Optionnel : version ajoutée à `onestock_api_root` (ex. `v3`). Par défaut l'URL est utilisée telle quelle. |
| `ADMIN_PASSWORD` | Optionnel : authentification basique sur toutes les pages (peu adaptée à l'affichage en iframe). |

## Démarrage

```bash
npm install
npm run db:migrate
npm run dev
```
