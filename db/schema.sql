-- Catalogue des extensions (commun à tous les sites)
CREATE TABLE IF NOT EXISTS extensions (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  installation_point TEXT NOT NULL,            -- ex : bo.page, bo.order.action, bo.orders.action
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS description TEXT;

-- Extensions installées par site
CREATE TABLE IF NOT EXISTS site_extensions (
  site_id      TEXT NOT NULL,
  extension_id TEXT NOT NULL REFERENCES extensions (id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, extension_id)
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
