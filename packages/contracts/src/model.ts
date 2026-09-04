import { z } from "zod";
import {
  ChangeSourceSchema,
  ElementKindSchema,
  ElementRoleSchema,
  InteractionStyleSchema,
  IssueLevelSchema,
  RecordKindSchema,
  RecordStatusSchema,
  SeveritySchema,
  ViewKindSchema,
  WorkspaceModeSchema,
} from "./enums";

export const IdSchema = z.string().min(1).max(64);
export const TagsSchema = z.array(z.string().min(1).max(64)).max(64);
export const PropertiesSchema = z.record(z.string(), z.string());

const name = z.string().min(1).max(200);
const optionalText = z.string().max(20_000).nullable().optional();

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export const WorkspaceSchema = z.object({
  id: IdSchema,
  name,
  description: z.string().nullable(),
  mode: WorkspaceModeSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = z.object({
  id: IdSchema.optional(),
  name,
  description: optionalText,
  mode: WorkspaceModeSchema.default("relaxed"),
});
export type CreateWorkspaceInput = z.input<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: name.optional(),
  description: optionalText,
  mode: WorkspaceModeSchema.optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

/* ------------------------------------------------------------------ */
/* Element                                                             */
/* ------------------------------------------------------------------ */

export const ArchitectureElementSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  parentId: IdSchema.nullable(),
  kind: ElementKindSchema,
  role: ElementRoleSchema.nullable(),
  name,
  description: z.string().nullable(),
  technology: z.string().nullable(),
  external: z.boolean(),
  tags: TagsSchema,
  properties: PropertiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArchitectureElement = z.infer<typeof ArchitectureElementSchema>;

export const CreateElementSchema = z.object({
  id: IdSchema.optional(),
  parentId: IdSchema.nullable().optional(),
  kind: ElementKindSchema,
  role: ElementRoleSchema.nullable().optional(),
  name,
  description: optionalText,
  technology: z.string().max(200).nullable().optional(),
  external: z.boolean().optional(),
  tags: TagsSchema.optional(),
  properties: PropertiesSchema.optional(),
});
export type CreateElementInput = z.infer<typeof CreateElementSchema>;

export const UpdateElementSchema = CreateElementSchema.omit({ id: true }).partial();
export type UpdateElementInput = z.infer<typeof UpdateElementSchema>;

/* ------------------------------------------------------------------ */
/* Relationship                                                        */
/* ------------------------------------------------------------------ */

export const ArchitectureRelationshipSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  sourceElementId: IdSchema,
  targetElementId: IdSchema,
  description: z.string().nullable(),
  technology: z.string().nullable(),
  interactionStyle: InteractionStyleSchema,
  tags: TagsSchema,
  properties: PropertiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArchitectureRelationship = z.infer<typeof ArchitectureRelationshipSchema>;

export const CreateRelationshipSchema = z.object({
  id: IdSchema.optional(),
  sourceElementId: IdSchema,
  targetElementId: IdSchema,
  description: z.string().max(500).nullable().optional(),
  technology: z.string().max(200).nullable().optional(),
  interactionStyle: InteractionStyleSchema.default("sync"),
  tags: TagsSchema.optional(),
  properties: PropertiesSchema.optional(),
});
export type CreateRelationshipInput = z.input<typeof CreateRelationshipSchema>;

export const UpdateRelationshipSchema = z.object({
  sourceElementId: IdSchema.optional(),
  targetElementId: IdSchema.optional(),
  description: z.string().max(500).nullable().optional(),
  technology: z.string().max(200).nullable().optional(),
  interactionStyle: InteractionStyleSchema.optional(),
  tags: TagsSchema.optional(),
  properties: PropertiesSchema.optional(),
});
export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipSchema>;

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

export const ViewSettingsSchema = z.object({
  showBoundaries: z.boolean().default(true),
  snapToGrid: z.boolean().default(false),
  autoLayoutDirection: z.enum(["LR", "TB"]).default("LR"),
});
export type ViewSettings = z.infer<typeof ViewSettingsSchema>;

export const ViewElementSchema = z.object({
  viewId: IdSchema,
  elementId: IdSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  hidden: z.boolean(),
  locked: z.boolean(),
  zIndex: z.number().int(),
});
export type ViewElement = z.infer<typeof ViewElementSchema>;

export const ControlPointSchema = z.object({ x: z.number(), y: z.number() });
export type ControlPoint = z.infer<typeof ControlPointSchema>;

export const ViewRelationshipSchema = z.object({
  viewId: IdSchema,
  relationshipId: IdSchema,
  hidden: z.boolean(),
  labelPosition: z.number().nullable(),
  controlPoints: z.array(ControlPointSchema),
});
export type ViewRelationship = z.infer<typeof ViewRelationshipSchema>;

export const ArchitectureViewSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  key: z.string().min(1).max(80),
  name,
  description: z.string().nullable(),
  kind: ViewKindSchema,
  scopeElementId: IdSchema.nullable(),
  settings: ViewSettingsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArchitectureView = z.infer<typeof ArchitectureViewSchema>;

/** A view together with its layout rows. */
export const ViewDetailSchema = ArchitectureViewSchema.extend({
  elements: z.array(ViewElementSchema),
  relationships: z.array(ViewRelationshipSchema),
});
export type ViewDetail = z.infer<typeof ViewDetailSchema>;

export const CreateViewSchema = z.object({
  id: IdSchema.optional(),
  key: z.string().min(1).max(80).optional(),
  name,
  description: optionalText,
  kind: ViewKindSchema,
  scopeElementId: IdSchema.nullable().optional(),
  settings: ViewSettingsSchema.partial().optional(),
  /** Optionally seed the view with these elements. */
  elementIds: z.array(IdSchema).optional(),
});
export type CreateViewInput = z.infer<typeof CreateViewSchema>;

export const UpdateViewSchema = z.object({
  key: z.string().min(1).max(80).optional(),
  name: name.optional(),
  description: optionalText,
  kind: ViewKindSchema.optional(),
  scopeElementId: IdSchema.nullable().optional(),
  settings: ViewSettingsSchema.partial().optional(),
});
export type UpdateViewInput = z.infer<typeof UpdateViewSchema>;

export const LayoutEntrySchema = z.object({
  elementId: IdSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  zIndex: z.number().int().optional(),
});
export type LayoutEntry = z.infer<typeof LayoutEntrySchema>;

export const ViewRelationshipPatchSchema = z.object({
  relationshipId: IdSchema,
  hidden: z.boolean().optional(),
  labelPosition: z.number().nullable().optional(),
  controlPoints: z.array(ControlPointSchema).optional(),
});
export type ViewRelationshipPatch = z.infer<typeof ViewRelationshipPatchSchema>;

/* ------------------------------------------------------------------ */
/* Records (presales)                                                  */
/* ------------------------------------------------------------------ */

export const ArchitectureRecordSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  kind: RecordKindSchema,
  title: z.string().min(1).max(300),
  contentMd: z.string().nullable(),
  status: RecordStatusSchema,
  severity: SeveritySchema.nullable(),
  linkedElementIds: z.array(IdSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArchitectureRecord = z.infer<typeof ArchitectureRecordSchema>;

export const CreateRecordSchema = z.object({
  id: IdSchema.optional(),
  kind: RecordKindSchema,
  title: z.string().min(1).max(300),
  contentMd: z.string().max(50_000).nullable().optional(),
  status: RecordStatusSchema.default("open"),
  severity: SeveritySchema.nullable().optional(),
  linkedElementIds: z.array(IdSchema).optional(),
});
export type CreateRecordInput = z.input<typeof CreateRecordSchema>;

export const UpdateRecordSchema = z.object({
  kind: RecordKindSchema.optional(),
  title: z.string().min(1).max(300).optional(),
  contentMd: z.string().max(50_000).nullable().optional(),
  status: RecordStatusSchema.optional(),
  severity: SeveritySchema.nullable().optional(),
  linkedElementIds: z.array(IdSchema).optional(),
});
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>;

/* ------------------------------------------------------------------ */
/* Snapshots & activity                                                */
/* ------------------------------------------------------------------ */

export const SnapshotSummarySchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  revision: z.number().int(),
  label: z.string(),
  source: ChangeSourceSchema,
  createdAt: z.string(),
});
export type SnapshotSummary = z.infer<typeof SnapshotSummarySchema>;

export const ActivityEntrySchema = z.object({
  id: z.number().int(),
  workspaceId: IdSchema,
  source: ChangeSourceSchema,
  message: z.string(),
  createdAt: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

/* ------------------------------------------------------------------ */
/* Aggregates                                                          */
/* ------------------------------------------------------------------ */

export const ArchitectureModelSchema = z.object({
  workspace: WorkspaceSchema,
  elements: z.array(ArchitectureElementSchema),
  relationships: z.array(ArchitectureRelationshipSchema),
  revision: z.number().int(),
});
export type ArchitectureModel = z.infer<typeof ArchitectureModelSchema>;

/** Full portable document — used by export/import and snapshots. */
export const WorkspaceDocumentSchema = z.object({
  formatVersion: z.literal(1),
  workspace: WorkspaceSchema,
  elements: z.array(ArchitectureElementSchema),
  relationships: z.array(ArchitectureRelationshipSchema),
  views: z.array(ViewDetailSchema),
  records: z.array(ArchitectureRecordSchema),
});
export type WorkspaceDocument = z.infer<typeof WorkspaceDocumentSchema>;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export const ValidationIssueSchema = z.object({
  level: IssueLevelSchema,
  code: z.string(),
  message: z.string(),
  elementId: IdSchema.optional(),
  relationshipId: IdSchema.optional(),
  viewId: IdSchema.optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
