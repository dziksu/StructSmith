import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ApplyOperationsRequest,
  ApplyOperationsRequestSchema,
  type ChatContext,
  PRODUCT,
  ReferenceTargetKindSchema,
  type Workspace,
} from "@structsmith/contracts";
import { badRequest, type Services } from "@structsmith/domain";
import { z } from "zod";
import { modelingGuide } from "./guide";
import { workspaceInspection } from "./inspection";
import { resolveReference } from "./reference";

type Awaitable<T> = T | Promise<T>;

/** Native and host-helper chats share one scoped tool surface. */
export interface ChatModelBackend {
  getWorkspace(id: string): Awaitable<Workspace>;
  listWorkspaces(): Awaitable<Workspace[]>;
  guide(): Awaitable<unknown>;
  inspect(id: string, options: { includeLayouts?: boolean }): Awaitable<unknown>;
  validate(id: string): Awaitable<unknown>;
  resolve(id: string, type: ChatContext["type"], targetId: string): Awaitable<unknown>;
  preview(id: string, input: ApplyOperationsRequest): Awaitable<unknown>;
  apply(id: string, input: ApplyOperationsRequest): Awaitable<unknown>;
}

export function localChatBackend(services: Services): ChatModelBackend {
  return {
    getWorkspace: (id) => services.workspaces.get(id),
    listWorkspaces: () => services.workspaces.list(),
    guide: modelingGuide,
    inspect: (id, options) => workspaceInspection(services, id, options),
    validate: (id) => services.model.validate(id),
    resolve: (id, type, targetId) => resolveReference(services, id, type, targetId),
    preview: (id, input) =>
      services.model.previewOperations(id, ApplyOperationsRequestSchema.parse(input)),
    apply: (id, input) =>
      services.model.applyOperations(id, ApplyOperationsRequestSchema.parse(input), "mcp"),
  };
}

/** A small, scoped surface for the in-app chat. It cannot mutate another project. */
export function createChatMcpServer(
  services: Services,
  workspaceId: string | null,
  readOnly: boolean,
): McpServer {
  return createBackendChatMcpServer(localChatBackend(services), workspaceId, readOnly);
}

export function createBackendChatMcpServer(
  backend: ChatModelBackend,
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
  server.registerTool("modeling_guide", { inputSchema: {}, annotations }, async () =>
    json(await backend.guide()),
  );
  server.registerTool("workspace_list", { inputSchema: {}, annotations }, async () =>
    json(workspaceId ? [await backend.getWorkspace(workspaceId)] : await backend.listWorkspaces()),
  );
  server.registerTool(
    "workspace_inspect",
    {
      inputSchema: { workspaceId: z.string(), includeLayouts: z.boolean().optional() },
      annotations,
    },
    async (input) => json(await backend.inspect(scopedId(input.workspaceId), input)),
  );
  server.registerTool(
    "model_validate",
    {
      inputSchema: { workspaceId: z.string() },
      annotations,
    },
    async (input) => json(await backend.validate(scopedId(input.workspaceId))),
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
    async (input) =>
      json(await backend.resolve(scopedId(input.workspaceId), input.type, input.targetId)),
  );
  const schema = { workspaceId: z.string(), ...ApplyOperationsRequestSchema.shape };
  server.registerTool(
    "model_preview_operations",
    { inputSchema: schema, annotations },
    async (input) => json(await backend.preview(scopedId(input.workspaceId), input)),
  );
  if (workspaceId && !readOnly) {
    server.registerTool(
      "model_apply_operations",
      {
        inputSchema: { ...schema, expectedRevision: z.number().int().nonnegative() },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      async (input) => json(await backend.apply(scopedId(input.workspaceId), input)),
    );
  }
  return server;
}
