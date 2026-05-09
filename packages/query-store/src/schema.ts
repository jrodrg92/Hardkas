export const SCHEMA_VERSION = 1;

export const DDL = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  hash TEXT PRIMARY KEY,
  schema TEXT NOT NULL,
  version TEXT NOT NULL,
  mode TEXT NOT NULL,
  network_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_schema ON artifacts(schema);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at);

CREATE TABLE IF NOT EXISTS lineage_edges (
  parent_hash TEXT NOT NULL,
  child_hash TEXT NOT NULL,
  rule TEXT NOT NULL,
  sequence INTEGER,
  PRIMARY KEY (parent_hash, child_hash),
  FOREIGN KEY (parent_hash) REFERENCES artifacts(hash),
  FOREIGN KEY (child_hash) REFERENCES artifacts(hash)
);

CREATE INDEX IF NOT EXISTS idx_lineage_parent ON lineage_edges(parent_hash);
CREATE INDEX IF NOT EXISTS idx_lineage_child ON lineage_edges(child_hash);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  tx_id TEXT,
  endpoint TEXT,
  created_at TEXT NOT NULL,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_tx_id ON events(tx_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
`;
