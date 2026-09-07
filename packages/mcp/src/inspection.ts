import { type Services, validateDocument } from "@structsmith/domain";

export interface WorkspaceInspectionOptions {
  includeLayouts?: boolean;
  includeHistory?: boolean;
}

/** Build one internally consistent semantic packet from a single document read. */
export function workspaceInspection(
  services: Services,
  workspaceId: string,
  options: WorkspaceInspectionOptions = {},
) {
  const document = services.model.getDocument(workspaceId);
  const views = options.includeLayouts
    ? document.views
    : document.views.map(({ elements: _elements, relationships: _relationships, ...view }) => view);

  return {
    workspace: document.workspace,
    revision: document.workspace.revision,
    counts: {
      elements: document.elements.length,
      relationships: document.relationships.length,
      views: document.views.length,
      records: document.records.length,
    },
    elements: document.elements,
    relationships: document.relationships,
    views,
    records: document.records,
    validation: validateDocument(document),
    ...(options.includeHistory
      ? {
          activity: services.activity.list(workspaceId, 25),
          snapshots: services.snapshots.list(workspaceId),
        }
      : {}),
  };
}
