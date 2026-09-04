CREATE TABLE workspaces (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  mode         TEXT NOT NULL DEFAULT 'relaxed',
  revision     INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE elements (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES elements(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  role            TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  technology      TEXT,
  external        INTEGER NOT NULL DEFAULT 0,
  tags_json       TEXT NOT NULL DEFAULT '[]',
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_elements_workspace ON elements(workspace_id);
CREATE INDEX idx_elements_parent ON elements(parent_id);

CREATE TABLE relationships (
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  target_element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  description       TEXT,
  technology        TEXT,
  interaction_style TEXT NOT NULL DEFAULT 'sync',
  tags_json         TEXT NOT NULL DEFAULT '[]',
  properties_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_relationships_workspace ON relationships(workspace_id);
CREATE INDEX idx_relationships_source ON relationships(source_element_id);
CREATE INDEX idx_relationships_target ON relationships(target_element_id);

CREATE TABLE views (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  kind             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  scope_element_id TEXT REFERENCES elements(id) ON DELETE SET NULL,
  settings_json    TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_views_workspace_key ON views(workspace_id, key);

CREATE TABLE view_elements (
  view_id    TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  x          REAL NOT NULL DEFAULT 0,
  y          REAL NOT NULL DEFAULT 0,
  width      REAL,
  height     REAL,
  hidden     INTEGER NOT NULL DEFAULT 0,
  locked     INTEGER NOT NULL DEFAULT 0,
  z_index    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (view_id, element_id)
);

CREATE TABLE view_relationships (
  view_id             TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  relationship_id     TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  hidden              INTEGER NOT NULL DEFAULT 0,
  label_position      REAL,
  control_points_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (view_id, relationship_id)
);

CREATE TABLE records (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  title        TEXT NOT NULL,
  content_md   TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  severity     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_records_workspace ON records(workspace_id);

CREATE TABLE record_links (
  record_id  TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  PRIMARY KEY (record_id, element_id)
);

CREATE TABLE snapshots (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision      INTEGER NOT NULL,
  label         TEXT NOT NULL,
  source        TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_snapshots_workspace ON snapshots(workspace_id, created_at DESC);

CREATE TABLE activity (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  message      TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_activity_workspace ON activity(workspace_id, id DESC);
