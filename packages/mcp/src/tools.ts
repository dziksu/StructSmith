import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ApplyOperationsRequestSchema,
  CreateElementSchema,
  CreateRecordSchema,
  CreateRelationshipSchema,
  CreateViewSchema,
  CreateWorkspaceSchema,
  LayoutDirectionSchema,
  LayoutEntrySchema,
  UpdateElementSchema,
  UpdateRecordSchema,
  UpdateRelationshipSchema,
  UpdateViewSchema,
  UpdateWorkspaceSchema,
} from "@structsmith/contracts";
import type { Services } from "@structsmith/domain";
import { z } from "zod";
import { MCP_TOOLS } from "./catalog";

export interface McpToolOptions {
  readOnly: boolean;
}

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const plain = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

const workspaceId = z.string().describe("Workspace id.");
const expectedRevision = z
  .number()
  .int()
  .optional()
  .describe("Optimistic concurrency guard — fails with a conflict when stale.");

const describe = (name: string): string =>
  MCP_TOOLS.find((tool) => tool.name === name)?.description ?? name;

export function registerTools(
  server: McpServer,
  services: Services,
  options: McpToolOptions,
): void {
  const readOnlyAnnotations = { readOnlyHint: true } as const;
  const writeAnnotations = { readOnlyHint: false, destructiveHint: false } as const;

  const registerWrite = (
    name: string,
    inputSchema: Record<string, z.ZodTypeAny>,
    handler: (args: never) => { content: { type: "text"; text: string }[] },
    destructive = false,
  ): void => {
    if (options.readOnly) return;
    server.registerTool(
      name,
      {
        description: describe(name),
        inputSchema,
        annotations: { ...writeAnnotations, destructiveHint: destructive },
      },
      handler as never,
    );
  };

  /* ----------------------------- workspaces ----------------------------- */

  server.registerTool(
    "workspace_list",
    { description: describe("workspace_list"), inputSchema: {}, annotations: readOnlyAnnotations },
    () => json(services.workspaces.list()),
  );

  server.registerTool(
    "workspace_get",
    {
      description: describe("workspace_get"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.workspaces.get(id)),
  );

  registerWrite("workspace_create", CreateWorkspaceSchema.shape, (args: unknown) =>
    json(services.workspaces.create(CreateWorkspaceSchema.parse(args))),
  );

  registerWrite(
    "workspace_update",
    { workspaceId, expectedRevision, data: UpdateWorkspaceSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: UpdateWorkspaceSchema,
        })
        .parse(args);
      return json(
        services.workspaces.update(input.workspaceId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "workspace_delete",
    { workspaceId },
    (args: unknown) => {
      const input = z.object({ workspaceId: z.string() }).parse(args);
      services.workspaces.delete(input.workspaceId);
      return json({ deleted: input.workspaceId });
    },
    true,
  );

  /* -------------------------------- model ------------------------------- */

  server.registerTool(
    "model_get",
    {
      description: describe("model_get"),
      inputSchema: { workspaceId, format: z.enum(["json", "outline"]).default("json") },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id, format }) =>
      format === "outline" ? plain(services.model.exportOutline(id)) : json(services.model.get(id)),
  );

  server.registerTool(
    "model_validate",
    {
      description: describe("model_validate"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.model.validate(id)),
  );

  registerWrite(
    "model_apply_operations",
    { workspaceId, ...ApplyOperationsRequestSchema.shape },
    (args: unknown) => {
      const input = z
        .object({ workspaceId: z.string() })
        .and(ApplyOperationsRequestSchema)
        .parse(args);
      return json(
        services.model.applyOperations(
          input.workspaceId,
          {
            expectedRevision: input.expectedRevision,
            label: input.label ?? "MCP change",
            operations: input.operations,
          },
          "mcp",
        ),
      );
    },
  );

  /* ------------------------------ elements ------------------------------ */

  registerWrite(
    "element_create",
    { workspaceId, expectedRevision, data: CreateElementSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: CreateElementSchema,
        })
        .parse(args);
      return json(
        services.elements.create(input.workspaceId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "element_update",
    { workspaceId, elementId: z.string(), expectedRevision, data: UpdateElementSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          elementId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: UpdateElementSchema,
        })
        .parse(args);
      return json(
        services.elements.update(input.workspaceId, input.elementId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "element_delete",
    { workspaceId, elementId: z.string(), expectedRevision, cascade: z.boolean().default(true) },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          elementId: z.string(),
          expectedRevision: z.number().int().optional(),
          cascade: z.boolean().default(true),
        })
        .parse(args);
      return json(
        services.elements.delete(input.workspaceId, input.elementId, {
          expectedRevision: input.expectedRevision,
          cascade: input.cascade,
          source: "mcp",
        }),
      );
    },
    true,
  );

  /* --------------------------- relationships ---------------------------- */

  registerWrite(
    "relationship_create",
    { workspaceId, expectedRevision, data: CreateRelationshipSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: CreateRelationshipSchema,
        })
        .parse(args);
      return json(
        services.relationships.create(input.workspaceId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "relationship_update",
    { workspaceId, relationshipId: z.string(), expectedRevision, data: UpdateRelationshipSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          relationshipId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: UpdateRelationshipSchema,
        })
        .parse(args);
      return json(
        services.relationships.update(input.workspaceId, input.relationshipId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "relationship_delete",
    { workspaceId, relationshipId: z.string(), expectedRevision },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          relationshipId: z.string(),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.relationships.delete(input.workspaceId, input.relationshipId, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
    true,
  );

  /* -------------------------------- views ------------------------------- */

  server.registerTool(
    "view_list",
    {
      description: describe("view_list"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.views.list(id)),
  );

  server.registerTool(
    "view_get",
    {
      description: describe("view_get"),
      inputSchema: { viewId: z.string() },
      annotations: readOnlyAnnotations,
    },
    ({ viewId }) => json(services.views.get(viewId)),
  );

  registerWrite(
    "view_create",
    { workspaceId, expectedRevision, data: CreateViewSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: CreateViewSchema,
        })
        .parse(args);
      return json(
        services.views.create(input.workspaceId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "view_update",
    { workspaceId, viewId: z.string(), expectedRevision, data: UpdateViewSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          viewId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: UpdateViewSchema,
        })
        .parse(args);
      return json(
        services.views.update(input.workspaceId, input.viewId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "view_delete",
    { workspaceId, viewId: z.string(), expectedRevision },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          viewId: z.string(),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.views.delete(input.workspaceId, input.viewId, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
    true,
  );

  registerWrite(
    "view_set_elements",
    {
      workspaceId,
      viewId: z.string(),
      elementIds: z.array(z.string()),
      mode: z.enum(["replace", "add", "remove"]).default("add"),
      expectedRevision,
    },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          viewId: z.string(),
          elementIds: z.array(z.string()),
          mode: z.enum(["replace", "add", "remove"]).default("add"),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.views.setElements(input.workspaceId, input.viewId, input.elementIds, input.mode, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "view_set_layout",
    { workspaceId, viewId: z.string(), entries: z.array(LayoutEntrySchema), expectedRevision },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          viewId: z.string(),
          entries: z.array(LayoutEntrySchema),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.views.saveLayout(input.workspaceId, input.viewId, input.entries, [], {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "view_auto_layout",
    {
      workspaceId,
      viewId: z.string(),
      direction: LayoutDirectionSchema.default("LR"),
      expectedRevision,
    },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          viewId: z.string(),
          direction: LayoutDirectionSchema.default("LR"),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.views.autoLayout(input.workspaceId, input.viewId, input.direction, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  /* ------------------------------- records ------------------------------ */

  server.registerTool(
    "record_list",
    {
      description: describe("record_list"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.records.list(id)),
  );

  registerWrite(
    "record_create",
    { workspaceId, expectedRevision, data: CreateRecordSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: CreateRecordSchema,
        })
        .parse(args);
      return json(
        services.records.create(input.workspaceId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "record_update",
    { workspaceId, recordId: z.string(), expectedRevision, data: UpdateRecordSchema },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          recordId: z.string(),
          expectedRevision: z.number().int().optional(),
          data: UpdateRecordSchema,
        })
        .parse(args);
      return json(
        services.records.update(input.workspaceId, input.recordId, input.data, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
  );

  registerWrite(
    "record_delete",
    { workspaceId, recordId: z.string(), expectedRevision },
    (args: unknown) => {
      const input = z
        .object({
          workspaceId: z.string(),
          recordId: z.string(),
          expectedRevision: z.number().int().optional(),
        })
        .parse(args);
      return json(
        services.records.delete(input.workspaceId, input.recordId, {
          expectedRevision: input.expectedRevision,
          source: "mcp",
        }),
      );
    },
    true,
  );

  /* ------------------------------ snapshots ----------------------------- */

  server.registerTool(
    "snapshot_list",
    {
      description: describe("snapshot_list"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.snapshots.list(id)),
  );

  registerWrite("snapshot_create", { workspaceId, label: z.string() }, (args: unknown) => {
    const input = z.object({ workspaceId: z.string(), label: z.string() }).parse(args);
    return json(services.snapshots.create(input.workspaceId, input.label, "mcp"));
  });

  registerWrite(
    "snapshot_restore",
    { snapshotId: z.string() },
    (args: unknown) => {
      const input = z.object({ snapshotId: z.string() }).parse(args);
      return json(services.snapshots.restore(input.snapshotId, "mcp"));
    },
    true,
  );

  /* ------------------------------- export ------------------------------- */

  server.registerTool(
    "export_json",
    {
      description: describe("export_json"),
      inputSchema: { workspaceId },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id }) => json(services.model.getDocument(id)),
  );

  server.registerTool(
    "export_mermaid",
    {
      description: describe("export_mermaid"),
      inputSchema: { workspaceId, viewId: z.string().optional() },
      annotations: readOnlyAnnotations,
    },
    ({ workspaceId: id, viewId }) => plain(services.model.exportMermaid(id, viewId)),
  );
}
