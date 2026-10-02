-- Catalogue des extensions utilisables sur le site
CREATE TABLE IF NOT EXISTS extensions (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  installation_point TEXT NOT NULL,            -- ex : bo.order, bo.product, ...
  installed          BOOLEAN NOT NULL DEFAULT false,
  settings_url       TEXT,                     -- lien spécifique vers la table settings (sinon VERCEL_SETTINGS_URL)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
