import type { ArchitectureElement, ArchitectureRelationship } from "@structsmith/contracts";

export interface ResolvedRelationship {
  /** Stable id: the relationship id for direct edges, a derived key otherwise. */
  id: string;
  sourceElementId: string;
  targetElementId: string;
  relationships: ArchitectureRelationship[];
  /** True when the edge stands in for relationships between hidden descendants. */
  implied: boolean;
}

/**
 * A view that shows a software system but not its containers still has to show
 * the traffic in and out of that system. Relationships whose endpoints are not
 * on the view are lifted to their nearest visible ancestor and merged — the
 * same rule Structurizr calls "implied relationships".
 */
export function resolveRelationshipsForView(
  elements: readonly ArchitectureElement[],
  relationships: readonly ArchitectureRelationship[],
  visibleIds: ReadonlySet<string>,
): ResolvedRelationship[] {
  const byId = new Map(elements.map((element) => [element.id, element]));

  const nearestVisible = (elementId: string): string | null => {
    let current: string | null = elementId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      if (visibleIds.has(current)) return current;
      seen.add(current);
      current = byId.get(current)?.parentId ?? null;
    }
    return null;
  };

  const merged = new Map<string, ResolvedRelationship>();

  for (const relationship of relationships) {
    const source = nearestVisible(relationship.sourceElementId);
    const target = nearestVisible(relationship.targetElementId);
    if (!source || !target || source === target) continue;

    const direct =
      source === relationship.sourceElementId && target === relationship.targetElementId;
    const key = direct ? relationship.id : `implied:${source}->${target}`;

    const existing = merged.get(key);
    if (existing) {
      existing.relationships.push(relationship);
      continue;
    }
    merged.set(key, {
      id: key,
      sourceElementId: source,
      targetElementId: target,
      relationships: [relationship],
      implied: !direct,
    });
  }

  return [...merged.values()];
}

/**
 * The label an edge carries on a diagram. Shared so that layout (which has to
 * reserve room for it) and rendering agree on exactly the same text.
 */
export function edgeLabel(edge: ResolvedRelationship): string {
  const [first] = edge.relationships;
  if (!first) return "";

  if (edge.implied) {
    const descriptions = [
      ...new Set(edge.relationships.map((item) => item.description).filter(Boolean)),
    ];
    return descriptions.join(", ");
  }

  return [first.description, first.technology ? `[${first.technology}]` : null]
    .filter(Boolean)
    .join(" ");
}
