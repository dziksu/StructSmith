import { z } from "zod";
import { ChangeSourceSchema, LayoutDirectionSchema } from "./enums";
import {
  IdSchema,
  LayoutEntrySchema,
  ViewRelationshipPatchSchema,
  WorkspaceDocumentSchema,
} from "./model";

/** Canonical error envelope returned by every failing REST call. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  ELEMENT_NOT_FOUND: "ELEMENT_NOT_FOUND",
  RELATIONSHIP_NOT_FOUND: "RELATIONSHIP_NOT_FOUND",
  VIEW_NOT_FOUND: "VIEW_NOT_FOUND",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  MODEL_RULE_VIOLATION: "MODEL_RULE_VIOLATION",
  READ_ONLY: "READ_ONLY",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Optimistic concurrency guard accepted by every mutating endpoint. */
export const RevisionGuardSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative().optional(),
});

export const UpdateLayoutRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative().optional(),
  entries: z.array(LayoutEntrySchema).default([]),
  relationships: z.array(ViewRelationshipPatchSchema).default([]),
});
export type UpdateLayoutRequest = z.input<typeof UpdateLayoutRequestSchema>;

export const AutoLayoutRequestSchema = z.object({
  direction: LayoutDirectionSchema.default("LR"),
});

export const CreateSnapshotRequestSchema = z.object({
  label: z.string().min(1).max(200),
  source: ChangeSourceSchema.default("ui"),
});

export const ImportWorkspaceRequestSchema = z.object({
  document: WorkspaceDocumentSchema,
  /** Import as a new workspace (default) or overwrite the referenced one. */
  mode: z.enum(["new", "overwrite"]).default("new"),
  name: z.string().min(1).max(200).optional(),
});
export type ImportWorkspaceRequest = z.input<typeof ImportWorkspaceRequestSchema>;

/** Payload of the `workspace.updated` SSE event. */
export const WorkspaceUpdatedEventSchema = z.object({
  workspaceId: IdSchema,
  revision: z.number().int(),
  source: ChangeSourceSchema,
  message: z.string().optional(),
});
export type WorkspaceUpdatedEvent = z.infer<typeof WorkspaceUpdatedEventSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ok", "error"]),
  mcp: z.enum(["ok", "disabled"]),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const McpInfoSchema = z.object({
  status: z.enum(["running", "stopped"]),
  transport: z.literal("streamable-http"),
  endpoint: z.string(),
  readOnly: z.boolean(),
  authMode: z.enum(["none", "token"]),
  tools: z.array(z.object({ name: z.string(), description: z.string(), mutating: z.boolean() })),
  resources: z.array(z.string()),
  prompts: z.array(z.object({ name: z.string(), description: z.string() })),
});
export type McpInfo = z.infer<typeof McpInfoSchema>;
