-- Catalogue des extensions (commun à tous les sites)
CREATE TABLE IF NOT EXISTS extensions (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  installation_point TEXT,                     -- obsolète : remplacé par injection_points
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS description TEXT;
-- Mêmes champs que l'API OneStock (le lien avec les extensions installées se fait sur le nom)
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS icon TEXT;                -- image base64
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS test_url TEXT;
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS rank INTEGER;                -- ordre d'affichage OneStock
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS injection_points JSONB NOT NULL DEFAULT '[]'::jsonb; -- [{anchor, name, slug, path, icon}]
ALTER TABLE extensions ALTER COLUMN installation_point DROP NOT NULL;

-- Journal des appels API (créé seulement s'il n'existe pas déjà)
CREATE TABLE IF NOT EXISTS api_logs (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  method      TEXT,
  url         TEXT,
  status      INTEGER,
  duration_ms INTEGER,
  request     JSONB,
  response    JSONB
);

CREATE INDEX IF NOT EXISTS api_logs_created_at_idx ON api_logs (created_at DESC);
