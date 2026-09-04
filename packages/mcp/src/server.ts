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
        `${PRODUCT.name} exposes a semantic architecture model (C4-style elements, relationships and views).`,
        "The diagram is not the source of truth — the model is. Layout lives on views only.",
        "Prefer `model_apply_operations` for anything larger than a single change: it is atomic,",
        "revision-guarded and creates a snapshot automatically.",
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
