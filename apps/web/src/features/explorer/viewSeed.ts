import type { ArchitectureElement } from "@structsmith/contracts";

/** Resolve the initial contents of an "All elements" view without leaking outside its scope. */
export function initialViewElementIds(
  elements: readonly Pick<ArchitectureElement, "id" | "parentId">[],
  scopeElementId: string | null,
): string[] {
  if (!scopeElementId) return elements.map((element) => element.id);

  const descendants = new Set<string>();
  let foundAnother = true;
  while (foundAnother) {
    foundAnother = false;
    for (const element of elements) {
      if (
        !descendants.has(element.id) &&
        (element.parentId === scopeElementId ||
          (element.parentId !== null && descendants.has(element.parentId)))
      ) {
        descendants.add(element.id);
        foundAnother = true;
      }
    }
  }

  return elements.filter((element) => descendants.has(element.id)).map((element) => element.id);
}
