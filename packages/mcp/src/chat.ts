import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ApplyOperationsRequestSchema,
  PRODUCT,
  ReferenceTargetKindSchema,
} from "@structsmith/contracts";
import { badRequest, type Services } from "@structsmith/domain";
import { z } from "zod";
import { modelingGuide } from "./guide";
import { workspaceInspection } from "./inspection";
import { resolveReference } from "./reference";

/** A small, scoped surface for the in-app chat. It cannot mutate another project. */
export function createChatMcpServer(
  services: Services,
  workspaceId: string | null,
  readOnly: boolean,
): McpServer {
  const server = new McpServer(
    { name: `${PRODUCT.slug}-chat`, version: PRODUCT.version },
    {
      instructions:
        "Use modeling_guide and workspace_inspect before editing. Preview changes, then apply one batch with expectedRevision. Only this chat's project can be edited.",
    },
  );
  const json = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  });
  const scopedId = (id: string) => {
    if (workspaceId && workspaceId !== id)
      throw badRequest("This chat is scoped to another project.");
    return id;
  };
  const annotations = { readOnlyHint: true, openWorldHint: false };
  server.registerTool("modeling_guide", { inputSchema: {}, annotations }, () =>
    json(modelingGuide()),
  );
  server.registerTool("workspace_list", { inputSchema: {}, annotations }, () =>
    json(workspaceId ? [services.workspaces.get(workspaceId)] : services.workspaces.list()),
  );
  server.registerTool(
    "workspace_inspect",
    {
      inputSchema: { workspaceId: z.string(), includeLayouts: z.boolean().optional() },
      annotations,
    },
    (input) => json(workspaceInspection(services, scopedId(input.workspaceId), input)),
  );
  server.registerTool(
    "model_validate",
    {
      inputSchema: { workspaceId: z.string() },
      annotations,
    },
    (input) => json(services.model.validate(scopedId(input.workspaceId))),
  );
  server.registerTool(
    "reference_resolve",
    {
      inputSchema: {
        workspaceId: z.string(),
        type: ReferenceTargetKindSchema,
        targetId: z.string(),
      },
      annotations,
    },
    (input) =>
      json(resolveReference(services, scopedId(input.workspaceId), input.type, input.targetId)),
  );
  const schema = { workspaceId: z.string(), ...ApplyOperationsRequestSchema.shape };
  server.registerTool("model_preview_operations", { inputSchema: schema, annotations }, (input) =>
    json(services.model.previewOperations(scopedId(input.workspaceId), input)),
  );
  if (workspaceId && !readOnly) {
    server.registerTool(
      "model_apply_operations",
      {
        inputSchema: { ...schema, expectedRevision: z.number().int().nonnegative() },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      (input) => json(services.model.applyOperations(scopedId(input.workspaceId), input, "mcp")),
    );
  }
  return server;
}
