ALTER TABLE boundaries ADD COLUMN view_id TEXT REFERENCES views(id) ON DELETE CASCADE;

-- Boundaries created before they became view-owned are attached to the
-- workspace's oldest view. No view means there was nowhere they could render.
UPDATE boundaries
SET view_id = (
  SELECT views.id
  FROM views
  WHERE views.workspace_id = boundaries.workspace_id
  ORDER BY views.created_at, views.id
  LIMIT 1
);

DELETE FROM boundaries WHERE view_id IS NULL;

CREATE INDEX idx_boundaries_view ON boundaries(view_id);
