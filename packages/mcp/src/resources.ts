import type { Services } from "@structsmith/domain";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const jsonResource = (uri: string, value: unknown) => ({
  contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }],
});

const first = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/**
 * Resources expose the semantic model only — no React internals, no viewport
 * data, nothing an AI client cannot reason about (spec §23).
 */
export function registerResources(server: McpServer, services: Services): void {
  server.registerResource(
    "workspaces",
    "architecture://workspaces",
    {
      title: "Workspaces",
      description: "All architecture workspaces on this server.",
      mimeType: "application/json",
    },
    (uri) => jsonResource(uri.href, services.workspaces.list()),
  );

  server.registerResource(
    "workspace",
    new ResourceTemplate("architecture://workspace/{workspaceId}", {
      list: () => ({
        resources: services.workspaces.list().map((workspace) => ({
          uri: `architecture://workspace/${workspace.id}`,
          name: workspace.name,
          mimeType: "application/json",
        })),
      }),
    }),
    { title: "Workspace", description: "A single workspace.", mimeType: "application/json" },
    (uri, variables) =>
      jsonResource(uri.href, services.workspaces.get(first(variables.workspaceId))),
  );

  server.registerResource(
    "workspace-model",
    new ResourceTemplate("architecture://workspace/{workspaceId}/model", { list: undefined }),
    {
      title: "Semantic model",
      description: "Elements and relationships of a workspace.",
      mimeType: "application/json",
    },
    (uri, variables) => jsonResource(uri.href, services.model.get(first(variables.workspaceId))),
  );

  server.registerResource(
    "workspace-views",
    new ResourceTemplate("architecture://workspace/{workspaceId}/views", { list: undefined }),
    { title: "Views", description: "Views defined for a workspace.", mimeType: "application/json" },
    (uri, variables) => jsonResource(uri.href, services.views.list(first(variables.workspaceId))),
  );

  server.registerResource(
    "workspace-view",
    new ResourceTemplate("architecture://workspace/{workspaceId}/view/{viewId}", {
      list: undefined,
    }),
    {
      title: "View",
      description: "A single view including its layout.",
      mimeType: "application/json",
    },
    (uri, variables) => jsonResource(uri.href, services.views.get(first(variables.viewId))),
  );

  server.registerResource(
    "workspace-records",
    new ResourceTemplate("architecture://workspace/{workspaceId}/records", { list: undefined }),
    {
      title: "Presales records",
      description: "Assumptions, risks, unknowns, requirements, decisions and notes.",
      mimeType: "application/json",
    },
    (uri, variables) => jsonResource(uri.href, services.records.list(first(variables.workspaceId))),
  );
}
