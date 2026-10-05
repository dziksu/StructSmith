import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  ERROR_CODES,
  type McpInfo,
  McpInfoSchema,
  PRODUCT,
  WorkspaceSchema,
} from "@structsmith/contracts";
import { DomainError } from "@structsmith/domain";
import type { ChatModelBackend } from "@structsmith/mcp";
import { z } from "zod";

export function assertLocalUrl(url: URL): void {
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("The Docker backend must use a plain HTTP localhost origin.");
}

/** The host holds no model database; reads and writes stay in the Docker domain. */
export class RemoteChatBackend implements ChatModelBackend {
  private readonly client = new Client({ name: "structsmith-local", version: PRODUCT.version });
  readonly readOnly: boolean;

  private constructor(
    readonly url: URL,
    private readonly token: string,
    readonly info: McpInfo,
  ) {
    this.readOnly = info.readOnly;
  }

  static async connect(url: URL, token: string): Promise<RemoteChatBackend> {
    assertLocalUrl(url);
    const response = await fetch(new URL("/api/mcp-info", url), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Cannot read Docker MCP settings: HTTP ${response.status}.`);
    const info = McpInfoSchema.parse(await response.json());
    const backend = new RemoteChatBackend(url, token, info);
    try {
      await backend.client.connect(
        new StreamableHTTPClientTransport(new URL("/mcp", url), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
        { timeout: 10000 },
      );
      return backend;
    } catch (error) {
      await backend.close();
      throw error;
    }
  }

  private async request(path: string): Promise<unknown> {
    const response = await fetch(new URL(path, this.url), {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10000),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const envelope = z
        .object({
          error: z.object({
            code: z.enum(ERROR_CODES),
            message: z.string(),
            details: z.unknown().optional(),
          }),
        })
        .safeParse(payload);
      throw new DomainError(
        envelope.success ? envelope.data.error.code : "BAD_REQUEST",
        envelope.success ? envelope.data.error.message : "Docker backend request failed.",
        response.status,
        envelope.success ? envelope.data.error.details : undefined,
      );
    }
    return payload;
  }

  async getWorkspace(id: string) {
    return WorkspaceSchema.parse(await this.request(`/api/workspaces/${encodeURIComponent(id)}`));
  }

  async listWorkspaces() {
    return z
      .object({ workspaces: z.array(WorkspaceSchema) })
      .parse(await this.request("/api/workspaces")).workspaces;
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = CallToolResultSchema.parse(
      await this.client.callTool({ name, arguments: args }, undefined, { timeout: 15000 }),
    );
    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (result.isError)
      throw new DomainError("BAD_REQUEST", text || "Docker MCP tool failed.", 400);
    return JSON.parse(text);
  }

  guide: ChatModelBackend["guide"] = () => this.call("modeling_guide", {});
  inspect: ChatModelBackend["inspect"] = (workspaceId, options) =>
    this.call("workspace_inspect", { workspaceId, ...options });
  validate: ChatModelBackend["validate"] = (workspaceId) =>
    this.call("model_validate", { workspaceId });
  resolve: ChatModelBackend["resolve"] = (workspaceId, type, targetId) =>
    this.call("reference_resolve", { workspaceId, type, targetId });
  preview: ChatModelBackend["preview"] = (workspaceId, input) =>
    this.call("model_preview_operations", { workspaceId, ...input });
  apply: ChatModelBackend["apply"] = (workspaceId, input) =>
    this.call("model_apply_operations", { workspaceId, ...input });

  async close(): Promise<void> {
    await this.client.close().catch(() => undefined);
  }
}
