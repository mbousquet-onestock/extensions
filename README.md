# Extensions

Petite app Next.js (déployable sur Vercel) qui :

- liste les extensions utilisables sur le site (table `extensions` de la base Postgres Vercel) avec ID, nom, point d'installation (`bo.order`, …), statut installée / non installée et un lien vers la table `settings` dans Vercel ;
- permet d'ajouter, modifier, installer/désinstaller et supprimer une extension ;
- affiche les appels API enregistrés dans la table `api_logs` (recherche, pagination) et permet de les purger (tout, ou les logs de plus de 1, 7 ou 30 jours).

## Configuration

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | Connexion à la base Postgres Vercel (Neon), injectée par Vercel quand la base est liée au projet. |
| `VERCEL_SETTINGS_URL` | Lien par défaut vers la table `settings` dans l'explorateur de données Vercel. Une extension peut avoir son propre lien (`settings_url`). |
| `ADMIN_PASSWORD` | Optionnel : active une authentification basique sur toutes les pages (sinon la purge des logs n'est pas protégée). |

## Démarrage

```bash
npm install
npm run db:migrate   # crée les tables extensions et api_logs si elles n'existent pas
npm run dev
```

La page des logs affiche dynamiquement les colonnes de `api_logs` : elle fonctionne aussi avec une table existante dont le schéma diffère de `db/schema.sql`. Le filtre de purge par ancienneté n'apparaît que si la table a une colonne `created_at`.
