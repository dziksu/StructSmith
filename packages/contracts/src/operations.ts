import { z } from "zod";
import { LayoutDirectionSchema } from "./enums";
import {
  CreateElementSchema,
  CreateRecordSchema,
  CreateRelationshipSchema,
  CreateViewSchema,
  IdSchema,
  LayoutEntrySchema,
  UpdateElementSchema,
  UpdateRecordSchema,
  UpdateRelationshipSchema,
  UpdateViewSchema,
  ViewRelationshipPatchSchema,
} from "./model";

/**
 * Batch operations are the preferred way for AI (MCP) and the UI to perform
 * multi-step changes atomically.
 *
 * Forward references: any id field may use `@<ref>` to point at an entity
 * created earlier in the same batch via the `ref` property.
 */

const ref = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe("Local alias for this new entity; reference it later as `@alias`.");

export const CreateElementOpSchema = z.object({
  op: z.literal("createElement"),
  ref,
  data: CreateElementSchema,
});

export const UpdateElementOpSchema = z.object({
  op: z.literal("updateElement"),
  elementId: IdSchema,
  data: UpdateElementSchema,
});

export const DeleteElementOpSchema = z.object({
  op: z.literal("deleteElement"),
  elementId: IdSchema,
  /** Also delete descendants; otherwise children are re-parented to the grandparent. */
  cascade: z.boolean().default(true),
});

export const CreateRelationshipOpSchema = z.object({
  op: z.literal("createRelationship"),
  ref,
  data: CreateRelationshipSchema,
});

export const UpdateRelationshipOpSchema = z.object({
  op: z.literal("updateRelationship"),
  relationshipId: IdSchema,
  data: UpdateRelationshipSchema,
});

export const DeleteRelationshipOpSchema = z.object({
  op: z.literal("deleteRelationship"),
  relationshipId: IdSchema,
});

export const CreateViewOpSchema = z.object({
  op: z.literal("createView"),
  ref,
  data: CreateViewSchema,
});

export const UpdateViewOpSchema = z.object({
  op: z.literal("updateView"),
  viewId: IdSchema,
  data: UpdateViewSchema,
});

export const DeleteViewOpSchema = z.object({
  op: z.literal("deleteView"),
  viewId: IdSchema,
});

export const SetViewElementsOpSchema = z.object({
  op: z.literal("setViewElements"),
  viewId: IdSchema,
  /** Element ids that should be present on the view. */
  elementIds: z.array(IdSchema),
  /** `replace` removes elements missing from the list, `add` only appends. */
  mode: z.enum(["replace", "add", "remove"]).default("add"),
});

export const SetViewRelationshipsOpSchema = z.object({
  op: z.literal("setViewRelationships"),
  viewId: IdSchema,
  relationships: z.array(ViewRelationshipPatchSchema),
});

export const SetLayoutOpSchema = z.object({
  op: z.literal("setLayout"),
  viewId: IdSchema,
  entries: z.array(LayoutEntrySchema),
});

export const AutoLayoutViewOpSchema = z.object({
  op: z.literal("autoLayoutView"),
  viewId: IdSchema,
  direction: LayoutDirectionSchema.default("LR"),
});

export const CreateRecordOpSchema = z.object({
  op: z.literal("createRecord"),
  ref,
  data: CreateRecordSchema,
});

export const UpdateRecordOpSchema = z.object({
  op: z.literal("updateRecord"),
  recordId: IdSchema,
  data: UpdateRecordSchema,
});

export const DeleteRecordOpSchema = z.object({
  op: z.literal("deleteRecord"),
  recordId: IdSchema,
});

export const ArchitectureOperationSchema = z.discriminatedUnion("op", [
  CreateElementOpSchema,
  UpdateElementOpSchema,
  DeleteElementOpSchema,
  CreateRelationshipOpSchema,
  UpdateRelationshipOpSchema,
  DeleteRelationshipOpSchema,
  CreateViewOpSchema,
  UpdateViewOpSchema,
  DeleteViewOpSchema,
  SetViewElementsOpSchema,
  SetViewRelationshipsOpSchema,
  SetLayoutOpSchema,
  AutoLayoutViewOpSchema,
  CreateRecordOpSchema,
  UpdateRecordOpSchema,
  DeleteRecordOpSchema,
]);
export type ArchitectureOperation = z.infer<typeof ArchitectureOperationSchema>;
export type ArchitectureOperationInput = z.input<typeof ArchitectureOperationSchema>;

export const ApplyOperationsRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative().optional(),
  label: z.string().max(200).optional(),
  operations: z.array(ArchitectureOperationSchema).min(1).max(500),
});
export type ApplyOperationsRequest = z.input<typeof ApplyOperationsRequestSchema>;

export const AppliedOperationSchema = z.object({
  op: z.string(),
  ref: z.string().optional(),
  id: z.string().optional(),
});

export const ApplyOperationsResultSchema = z.object({
  success: z.boolean(),
  previousRevision: z.number().int(),
  revision: z.number().int(),
  appliedOperations: z.array(AppliedOperationSchema),
  warnings: z.array(z.string()),
  snapshotId: z.string().nullable(),
});
export type ApplyOperationsResult = z.infer<typeof ApplyOperationsResultSchema>;
