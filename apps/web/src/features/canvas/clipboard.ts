import type {
  ArchitectureElement,
  ArchitectureOperationInput,
  ArchitectureRelationship,
  ViewDetail,
} from "@structsmith/contracts";
import type { DiagramClipboard } from "@/store/editor";

export function createDiagramClipboard(
  workspaceId: string,
  view: ViewDetail,
  elements: readonly ArchitectureElement[],
  relationships: readonly ArchitectureRelationship[],
  selectedElementIds: readonly string[],
): DiagramClipboard | null {
  const selected = new Set(selectedElementIds);
  const copiedElements = elements.filter((element) => selected.has(element.id));
  if (copiedElements.length === 0) return null;

  const copiedRelationships = relationships.filter(
    (relationship) =>
      selected.has(relationship.sourceElementId) && selected.has(relationship.targetElementId),
  );
  const copiedRelationshipIds = new Set(copiedRelationships.map((relationship) => relationship.id));

  return {
    workspaceId,
    viewId: view.id,
    elements: copiedElements,
    relationships: copiedRelationships,
    placements: view.elements.filter((placement) => selected.has(placement.elementId)),
    relationshipPlacements: view.relationships.filter((placement) =>
      copiedRelationshipIds.has(placement.relationshipId),
    ),
    boundaryMemberships: view.boundaries.flatMap((boundary) => {
      const elementIds = boundary.elementIds.filter((elementId) => selected.has(elementId));
      return elementIds.length > 0 ? [{ boundaryId: boundary.id, elementIds }] : [];
    }),
    pasteCount: 0,
  };
}

export function buildPasteOperations(
  clipboard: DiagramClipboard,
  workspaceId: string,
  viewId: string,
): ArchitectureOperationInput[] {
  const offset = 40 * (clipboard.pasteCount + 1);
  const elementRefs = new Map(
    clipboard.elements.map((element, index) => [element.id, `copy-element-${index}`] as const),
  );
  const relationshipRefs = new Map(
    clipboard.relationships.map(
      (relationship, index) => [relationship.id, `copy-relationship-${index}`] as const,
    ),
  );
  const referenceTo = (elementId: string): string => `@${elementRefs.get(elementId)}`;
  const sameWorkspace = clipboard.workspaceId === workspaceId;

  const operations: ArchitectureOperationInput[] = clipboard.elements.map((element) => ({
    op: "createElement" as const,
    ref: elementRefs.get(element.id),
    data: {
      parentId: element.parentId
        ? elementRefs.has(element.parentId)
          ? referenceTo(element.parentId)
          : sameWorkspace
            ? element.parentId
            : null
        : null,
      kind: element.kind,
      role: element.role,
      name: `${element.name} (copy)`,
      description: element.description,
      technology: element.technology,
      external: element.external,
      tags: element.tags,
      properties: element.properties,
    },
  }));

  operations.push({
    op: "setViewElements",
    viewId,
    elementIds: clipboard.elements.map((element) => referenceTo(element.id)),
    mode: "add",
  });
  operations.push({
    op: "setLayout",
    viewId,
    entries: clipboard.elements.map((element) => {
      const placement = clipboard.placements.find((item) => item.elementId === element.id);
      return {
        elementId: referenceTo(element.id),
        x: (placement?.x ?? 0) + offset,
        y: (placement?.y ?? 0) + offset,
        width: placement?.width,
        height: placement?.height,
        hidden: false,
        locked: placement?.locked ?? false,
        zIndex: placement?.zIndex ?? 0,
      };
    }),
  });

  for (const relationship of clipboard.relationships) {
    operations.push({
      op: "createRelationship",
      ref: relationshipRefs.get(relationship.id),
      data: {
        sourceElementId: referenceTo(relationship.sourceElementId),
        targetElementId: referenceTo(relationship.targetElementId),
        description: relationship.description,
        technology: relationship.technology,
        interactionStyle: relationship.interactionStyle,
        tags: relationship.tags,
        properties: relationship.properties,
      },
    });
  }

  if (sameWorkspace && clipboard.viewId === viewId && clipboard.boundaryMemberships.length > 0) {
    for (const membership of clipboard.boundaryMemberships) {
      operations.push({
        op: "setBoundaryMembers",
        boundaryId: membership.boundaryId,
        elementIds: membership.elementIds.map(referenceTo),
        mode: "add",
      });
    }
  }

  const relationshipPatches = clipboard.relationshipPlacements.flatMap((placement) => {
    const ref = relationshipRefs.get(placement.relationshipId);
    return ref
      ? [
          {
            relationshipId: `@${ref}`,
            hidden: placement.hidden,
            labelPosition: placement.labelPosition,
            controlPoints: placement.controlPoints.map((point) => ({
              x: point.x + offset,
              y: point.y + offset,
            })),
          },
        ]
      : [];
  });
  if (relationshipPatches.length > 0) {
    operations.push({
      op: "setViewRelationships",
      viewId,
      relationships: relationshipPatches,
    });
  }

  return operations;
}
