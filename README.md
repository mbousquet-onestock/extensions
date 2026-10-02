# Extensions

App Next.js (déployée sur Vercel) chargée en iframe dans OneStock comme UI extension.

- **Contexte** : récupère les paramètres d'URL envoyés par OneStock (`site_id`, `extension_id`, `user_id`, `lang`, `host_app`, `parent_url`, …), fait le handshake `extension_ready` → `onestock_data` par postMessage et vérifie `extension_signature` (HMAC-SHA256 de `${t}.${extension_id}##${user_id}`, valable 6 h) côté serveur. Le contexte est affiché en haut de chaque page et conservé dans les liens. Hors OneStock, on peut saisir un `site_id` à la main.
- **Extensions** (`/`) : catalogue commun à tous les sites (créer, modifier, supprimer) et liste des extensions installées sur le `site_id` du contexte (installer / désinstaller).
- **Settings d'une extension** (`/extensions/<id>/settings`) : lignes de la table `settings` dont `extension_id` correspond (et `site_id` si la colonne existe).
- **Settings généraux** (`/settings`) : table `general_settings` (filtrée par `site_id` si la colonne existe) ; à défaut, lignes de `settings` sans `extension_id`.
- **Logs API** (`/logs`) : table `api_logs` (recherche, pagination, purge totale ou par ancienneté).

Les pages de settings et de logs affichent les colonnes réelles des tables : elles s'adaptent au schéma existant.

## Tables

Créées automatiquement au premier accès (ou via `npm run db:migrate`) :

- `extensions` (`id`, `name`, `installation_point`, `description`)
- `site_extensions` (`site_id`, `extension_id`, `installed_at`) : extensions installées par site

## Configuration

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | Connexion à la base Postgres Vercel (Neon). |
| `EXTENSION_SECRETS` | Clé(s) secrète(s) OneStock pour vérifier la signature, séparées par des virgules. Sans elle, la signature n'est pas vérifiée. |
| `SETTINGS_TABLE` | Table des settings par extension (défaut `settings`). |
| `GENERAL_SETTINGS_TABLE` | Table des settings généraux (défaut `general_settings`). |
| `ADMIN_PASSWORD` | Optionnel : authentification basique sur toutes les pages (peu adaptée à l'affichage en iframe). |

## Démarrage

```bash
npm install
npm run db:migrate
npm run dev
```
