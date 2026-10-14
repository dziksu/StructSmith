import type { ArchitectureElement } from "@structsmith/contracts";
import type { Selection } from "@/store/editor";

/** Derived frames select their inspector explicitly and never own card selection. */
export function selectionFromCanvas(
  elementIds: readonly string[],
  relationshipIds: readonly string[],
  current: Selection,
): Selection {
  if (elementIds.length > 1) return { type: "elements", ids: [...elementIds].sort() };
  if (elementIds[0]) return { type: "element", id: elementIds[0] };
  if (relationshipIds[0]) return { type: "relationship", id: relationshipIds[0] };
  return current.type === "boundary" || current.type === "view" || current.type === "record"
    ? current
    : { type: "none" };
}

/** Cascade each selected subtree once, even when both parent and child are selected. */
export function modelDeletionRoots(
  elementIds: readonly string[],
  elementsById: ReadonlyMap<string, ArchitectureElement>,
): string[] {
  const selected = new Set(elementIds);
  return [...selected].filter((id) => {
    const visited = new Set([id]);
    let parentId = elementsById.get(id)?.parentId;
    while (parentId && !visited.has(parentId)) {
      if (selected.has(parentId)) return false;
      visited.add(parentId);
      parentId = elementsById.get(parentId)?.parentId;
    }
    return true;
  });
}
