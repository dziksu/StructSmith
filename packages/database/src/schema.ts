import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  mode: text("mode").notNull().default("relaxed"),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const elements = sqliteTable(
  "elements",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    kind: text("kind").notNull(),
    role: text("role"),
    name: text("name").notNull(),
    description: text("description"),
    technology: text("technology"),
    external: integer("external").notNull().default(0),
    tagsJson: text("tags_json").notNull().default("[]"),
    propertiesJson: text("properties_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_elements_workspace").on(table.workspaceId),
    index("idx_elements_parent").on(table.parentId),
  ],
);

export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceElementId: text("source_element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
    targetElementId: text("target_element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
    description: text("description"),
    technology: text("technology"),
    interactionStyle: text("interaction_style").notNull().default("sync"),
    tagsJson: text("tags_json").notNull().default("[]"),
    propertiesJson: text("properties_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_relationships_workspace").on(table.workspaceId),
    index("idx_relationships_source").on(table.sourceElementId),
    index("idx_relationships_target").on(table.targetElementId),
  ],
);

export const views = sqliteTable(
  "views",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    scopeElementId: text("scope_element_id").references(() => elements.id, { onDelete: "set null" }),
    settingsJson: text("settings_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_views_workspace_key").on(table.workspaceId, table.key)],
);

export const viewElements = sqliteTable(
  "view_elements",
  {
    viewId: text("view_id")
      .notNull()
      .references(() => views.id, { onDelete: "cascade" }),
    elementId: text("element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    width: real("width"),
    height: real("height"),
    hidden: integer("hidden").notNull().default(0),
    locked: integer("locked").notNull().default(0),
    zIndex: integer("z_index").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.viewId, table.elementId] })],
);

export const viewRelationships = sqliteTable(
  "view_relationships",
  {
    viewId: text("view_id")
      .notNull()
      .references(() => views.id, { onDelete: "cascade" }),
    relationshipId: text("relationship_id")
      .notNull()
      .references(() => relationships.id, { onDelete: "cascade" }),
    hidden: integer("hidden").notNull().default(0),
    labelPosition: real("label_position"),
    controlPointsJson: text("control_points_json").notNull().default("[]"),
  },
  (table) => [primaryKey({ columns: [table.viewId, table.relationshipId] })],
);

export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    contentMd: text("content_md"),
    status: text("status").notNull().default("open"),
    severity: text("severity"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_records_workspace").on(table.workspaceId)],
);

export const recordLinks = sqliteTable(
  "record_links",
  {
    recordId: text("record_id")
      .notNull()
      .references(() => records.id, { onDelete: "cascade" }),
    elementId: text("element_id")
      .notNull()
      .references(() => elements.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.recordId, table.elementId] })],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    label: text("label").notNull(),
    source: text("source").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_snapshots_workspace").on(table.workspaceId, table.createdAt)],
);

export const activity = sqliteTable(
  "activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_activity_workspace").on(table.workspaceId, table.id)],
);

export const schemaMigrations = sqliteTable("schema_migrations", {
  name: text("name").primaryKey(),
  appliedAt: text("applied_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
