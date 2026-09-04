import type { ArchitectureElement, ElementKind } from "@structsmith/contracts";

/** Which parent kinds are allowed for a given element kind (spec §11). */
const ALLOWED_PARENTS: Record<ElementKind, readonly ElementKind[]> = {
  person: [],
  softwareSystem: [],
  container: ["softwareSystem"],
  component: ["container"],
  deploymentNode: ["deploymentNode"],
  infrastructureNode: ["deploymentNode"],
  custom: [
    "person",
    "softwareSystem",
    "container",
    "component",
    "deploymentNode",
    "infrastructureNode",
    "custom",
  ],
};

/** Kinds that can never contain children. */
export const LEAF_KINDS: readonly ElementKind[] = ["person"];

export interface HierarchyProblem {
  code: string;
  message: string;
}

export function checkParent(
  child: Pick<ArchitectureElement, "kind" | "name">,
  parent: Pick<ArchitectureElement, "kind" | "name"> | undefined,
): HierarchyProblem | null {
  if (!parent) return null;

  if (LEAF_KINDS.includes(parent.kind)) {
    return {
      code: "PARENT_CANNOT_HAVE_CHILDREN",
      message: `"${parent.name}" is a ${parent.kind} and cannot contain other elements.`,
    };
  }

  const allowed = ALLOWED_PARENTS[child.kind];
  if (allowed.length === 0) {
    return {
      code: "KIND_CANNOT_BE_NESTED",
      message: `A ${child.kind} cannot be nested inside another element.`,
    };
  }
  if (!allowed.includes(parent.kind) && parent.kind !== "custom") {
    return {
      code: "INVALID_PARENT_KIND",
      message: `A ${child.kind} cannot live inside a ${parent.kind}; expected one of: ${allowed.join(", ")}.`,
    };
  }
  return null;
}

/** Detects a cycle that would be introduced by setting `parentId` on `elementId`. */
export function wouldCreateCycle(
  elementId: string,
  parentId: string | null,
  parentOf: (id: string) => string | null | undefined,
): boolean {
  let current = parentId;
  const seen = new Set<string>([elementId]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentOf(current) ?? null;
  }
  return false;
}

export function descendantsOf(
  elementId: string,
  elements: readonly ArchitectureElement[],
): ArchitectureElement[] {
  const byParent = new Map<string, ArchitectureElement[]>();
  for (const element of elements) {
    if (!element.parentId) continue;
    const bucket = byParent.get(element.parentId);
    if (bucket) bucket.push(element);
    else byParent.set(element.parentId, [element]);
  }
  const out: ArchitectureElement[] = [];
  const queue = [elementId];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    for (const child of byParent.get(current) ?? []) {
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}
