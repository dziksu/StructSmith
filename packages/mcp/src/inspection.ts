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
  const nestedBoundaries = document.views.flatMap((view) => view.boundaries);
  const boundaryCount =
    nestedBoundaries.length > 0 ? nestedBoundaries.length : (document.boundaries ?? []).length;
  const views = options.includeLayouts
    ? document.views
    : document.views.map(({ elements, relationships, ...view }) => ({
        ...view,
        // Membership is semantic view context, so keep it in the default
        // packet while dropping the coordinates and routing geometry.
        elements: elements.map(({ elementId, hidden }) => ({ elementId, hidden })),
        relationships: relationships.map(({ relationshipId, hidden }) => ({
          relationshipId,
          hidden,
        })),
      }));

  return {
    workspace: document.workspace,
    revision: document.workspace.revision,
    layoutsIncluded: options.includeLayouts ?? false,
    counts: {
      elements: document.elements.length,
      boundaries: boundaryCount,
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
