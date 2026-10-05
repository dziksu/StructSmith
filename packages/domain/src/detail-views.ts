import type {
  ArchitectureElement,
  ArchitectureRelationship,
  ArchitectureView,
  ViewKind,
} from "@structsmith/contracts";

export function detailViewKind(element: Pick<ArchitectureElement, "kind">): ViewKind | null {
  if (element.kind === "softwareSystem") return "container";
  if (element.kind === "container") return "component";
  return null;
}

/** Scope alone is insufficient: a system context is not a system's interior. */
export function detailViewsFor<
  T extends Pick<ArchitectureView, "id" | "name" | "kind" | "scopeElementId">,
>(
  element: Pick<ArchitectureElement, "id" | "kind">,
  views: readonly T[],
  currentViewId: string | null = null,
): T[] {
  const kind = detailViewKind(element);
  if (!kind) return [];
  return views
    .filter(
      (view) =>
        view.id !== currentViewId && view.scopeElementId === element.id && view.kind === kind,
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** One level of children and their connected context, using existing model IDs. */
export function detailViewElementIds(
  scope: ArchitectureElement,
  elements: readonly ArchitectureElement[],
  relationships: readonly ArchitectureRelationship[],
): string[] {
  if (!detailViewKind(scope)) return [];
  const byId = new Map(elements.map((element) => [element.id, element]));
  const children = new Set(
    elements.filter((element) => element.parentId === scope.id).map((element) => element.id),
  );
  const visible = new Set(children);
  const childOfScope = (id: string): string | null => {
    const seen = new Set<string>();
    let element = byId.get(id);
    while (element && !seen.has(element.id)) {
      if (children.has(element.id)) return element.id;
      seen.add(element.id);
      element = element.parentId ? byId.get(element.parentId) : undefined;
    }
    return null;
  };
  const contextObject = (id: string): string | null => {
    const seen = new Set<string>([scope.id]);
    let element = byId.get(id);
    while (element && !seen.has(element.id)) {
      seen.add(element.id);
      if (!element.parentId || (scope.kind === "container" && element.parentId === scope.parentId))
        return element.id;
      element = byId.get(element.parentId);
    }
    return null;
  };
  for (const relationship of relationships) {
    const source = childOfScope(relationship.sourceElementId);
    const target = childOfScope(relationship.targetElementId);
    if (Boolean(source) === Boolean(target)) continue;
    const contextId = contextObject(
      source ? relationship.targetElementId : relationship.sourceElementId,
    );
    if (contextId) visible.add(contextId);
  }
  return elements.filter((element) => visible.has(element.id)).map((element) => element.id);
}
