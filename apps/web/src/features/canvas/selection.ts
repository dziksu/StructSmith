import type { ArchitectureElement } from "@structsmith/contracts";

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
