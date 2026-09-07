import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PRODUCT } from "@structsmith/contracts";
import type { Services } from "@structsmith/domain";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

export interface McpServerOptions {
  services: Services;
  /** When true, no mutating tool is registered at all (spec §53). */
  readOnly: boolean;
}

export function createMcpServer({ services, readOnly }: McpServerOptions): McpServer {
  const server = new McpServer(
    { name: PRODUCT.slug, version: PRODUCT.version },
    {
      instructions: [
        `Start with workspace_list, then workspace_inspect. Call modeling_guide for model rules and allowed values; never inspect ${PRODUCT.name} source code to discover schemas. For multi-entity changes use model_preview_operations, then one model_apply_operations batch with @ref aliases, and finish with model_validate. The semantic model is the source of truth; views only control membership and layout. Model a relationship once at the most specific C4 level because views automatically lift descendant relationships.`,
        "Use expectedRevision when replacing or deleting existing data. On conflict inspect again and reconcile before retrying.",
        readOnly
          ? "This server is running in read-only mode; no mutating tools are available."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  );

  registerTools(server, services, { readOnly });
  registerResources(server, services);
  registerPrompts(server);

  return server;
}
