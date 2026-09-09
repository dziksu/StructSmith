import type { ReferenceTargetKind } from "@structsmith/contracts";
import type { Services } from "@structsmith/domain";

export function resolveReference(
  services: Services,
  workspaceId: string,
  type: ReferenceTargetKind,
  targetId: string,
) {
  const document = services.model.getDocument(workspaceId);
  const reference = { type, workspaceId, targetId, revision: document.workspace.revision };

  if (type === "workspace") {
    if (targetId !== workspaceId) {
      throw new Error(`Workspace reference ${targetId} does not match ${workspaceId}.`);
    }
    return { reference, target: document.workspace };
  }

  if (type === "view") {
    const target = document.views.find((item) => item.id === targetId);
    if (!target) throw new Error(`View not found: ${targetId}`);
    return { reference, target };
  }

  if (type === "element") {
    const target = document.elements.find((item) => item.id === targetId);
    if (!target) throw new Error(`Element not found: ${targetId}`);
    return {
      reference,
      target,
      context: {
        parent: document.elements.find((item) => item.id === target.parentId) ?? null,
        children: document.elements.filter((item) => item.parentId === target.id),
        relationships: document.relationships.filter(
          (item) => item.sourceElementId === target.id || item.targetElementId === target.id,
        ),
        views: document.views
          .filter((view) => view.elements.some((entry) => entry.elementId === target.id))
          .map(({ id, name, kind }) => ({ id, name, kind })),
      },
    };
  }

  if (type === "boundary") {
    const nestedBoundaries = document.views.flatMap((view) => view.boundaries);
    const boundaries = nestedBoundaries.length > 0 ? nestedBoundaries : (document.boundaries ?? []);
    const target = boundaries.find((item) => item.id === targetId);
    if (!target) throw new Error(`Boundary not found: ${targetId}`);
    return {
      reference,
      target,
      context: {
        view: document.views.find((item) => item.id === target.viewId) ?? null,
        parent:
          boundaries.find(
            (item) => item.viewId === target.viewId && item.id === target.parentBoundaryId,
          ) ?? null,
        children: boundaries.filter(
          (item) => item.viewId === target.viewId && item.parentBoundaryId === target.id,
        ),
        members: document.elements.filter((item) => target.elementIds.includes(item.id)),
      },
    };
  }

  if (type === "relationship") {
    const target = document.relationships.find((item) => item.id === targetId);
    if (!target) throw new Error(`Relationship not found: ${targetId}`);
    return {
      reference,
      target,
      context: {
        source: document.elements.find((item) => item.id === target.sourceElementId) ?? null,
        target: document.elements.find((item) => item.id === target.targetElementId) ?? null,
        views: document.views
          .filter((view) => view.relationships.some((entry) => entry.relationshipId === target.id))
          .map(({ id, name, kind }) => ({ id, name, kind })),
      },
    };
  }

  const target = document.records.find((item) => item.id === targetId);
  if (!target) throw new Error(`Record not found: ${targetId}`);
  return {
    reference,
    target,
    context: {
      linkedElements: document.elements.filter((item) => target.linkedElementIds.includes(item.id)),
    },
  };
}
