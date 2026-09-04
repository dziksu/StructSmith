export interface McpToolInfo {
  name: string;
  description: string;
  mutating: boolean;
}

/** Advertised in the UI (Settings → MCP) and used to gate read-only mode. */
export const MCP_TOOLS: readonly McpToolInfo[] = [
  { name: "workspace_list", description: "List all workspaces.", mutating: false },
  { name: "workspace_get", description: "Read a single workspace.", mutating: false },
  { name: "workspace_create", description: "Create a workspace.", mutating: true },
  { name: "workspace_update", description: "Rename a workspace or change its mode.", mutating: true },
  { name: "workspace_delete", description: "Delete a workspace and everything in it.", mutating: true },

  { name: "model_get", description: "Read the semantic model (elements + relationships).", mutating: false },
  { name: "model_validate", description: "Run the deterministic architecture validator.", mutating: false },
  {
    name: "model_apply_operations",
    description: "Apply a batch of model operations atomically. Preferred for larger changes.",
    mutating: true,
  },

  { name: "element_create", description: "Add an element to the model.", mutating: true },
  { name: "element_update", description: "Update an element.", mutating: true },
  { name: "element_delete", description: "Delete an element from the model.", mutating: true },

  { name: "relationship_create", description: "Connect two elements.", mutating: true },
  { name: "relationship_update", description: "Update a relationship.", mutating: true },
  { name: "relationship_delete", description: "Delete a relationship.", mutating: true },

  { name: "view_list", description: "List the views of a workspace.", mutating: false },
  { name: "view_get", description: "Read a view including its layout.", mutating: false },
  { name: "view_create", description: "Create a view.", mutating: true },
  { name: "view_update", description: "Update a view.", mutating: true },
  { name: "view_delete", description: "Delete a view (the model is untouched).", mutating: true },
  { name: "view_set_elements", description: "Add or remove elements on a view.", mutating: true },
  { name: "view_set_layout", description: "Write element positions for a view.", mutating: true },
  { name: "view_auto_layout", description: "Arrange a view automatically (dagre).", mutating: true },

  { name: "record_list", description: "List presales records (risks, assumptions, …).", mutating: false },
  { name: "record_create", description: "Create a presales record.", mutating: true },
  { name: "record_update", description: "Update a presales record.", mutating: true },
  { name: "record_delete", description: "Delete a presales record.", mutating: true },

  { name: "snapshot_list", description: "List workspace snapshots.", mutating: false },
  { name: "snapshot_create", description: "Create a snapshot.", mutating: true },
  { name: "snapshot_restore", description: "Restore a snapshot.", mutating: true },

  { name: "export_json", description: "Export the full workspace document as JSON.", mutating: false },
  { name: "export_mermaid", description: "Export the model or a view as a Mermaid diagram.", mutating: false },
];

export const MCP_RESOURCES: readonly string[] = [
  "architecture://workspaces",
  "architecture://workspace/{workspaceId}",
  "architecture://workspace/{workspaceId}/model",
  "architecture://workspace/{workspaceId}/views",
  "architecture://workspace/{workspaceId}/view/{viewId}",
  "architecture://workspace/{workspaceId}/records",
];

export interface McpPromptInfo {
  name: string;
  description: string;
}

export const MCP_PROMPTS: readonly McpPromptInfo[] = [
  { name: "review_architecture", description: "Review the architecture of a workspace." },
  { name: "create_presales_architecture", description: "Draft a presales architecture from a brief." },
  { name: "identify_architecture_risks", description: "List architectural risks and record them." },
  { name: "identify_unknowns", description: "Find open questions for a discovery call." },
  { name: "review_security", description: "Review the architecture from a security angle." },
  { name: "review_scalability", description: "Review the architecture for scalability." },
];
