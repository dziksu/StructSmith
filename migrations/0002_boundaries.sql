CREATE TABLE boundaries (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_boundary_id TEXT,
  kind               TEXT NOT NULL,
  layer              TEXT NOT NULL DEFAULT 'deployment',
  classification     TEXT,
  name               TEXT NOT NULL,
  description        TEXT,
  tags_json          TEXT NOT NULL DEFAULT '[]',
  properties_json    TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY (parent_boundary_id) REFERENCES boundaries(id) ON DELETE SET NULL
);
CREATE INDEX idx_boundaries_workspace ON boundaries(workspace_id);
CREATE INDEX idx_boundaries_parent ON boundaries(parent_boundary_id);

CREATE TABLE boundary_members (
  boundary_id TEXT NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  element_id  TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  PRIMARY KEY (boundary_id, element_id)
);
