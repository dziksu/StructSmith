import type {
  ArchitectureBoundary,
  ArchitectureElement,
  ArchitectureRelationship,
  ViewDetail,
  WorkspaceDocument,
} from "@structsmith/contracts";
import { resolveRelationshipsForView } from "./implied";

const escapeLabel = (value: string): string => value.replace(/"/g, "'").replace(/\n/g, " ");

const nodeId = (id: string): string => `n_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;

function elementLabel(element: ArchitectureElement): string {
  const lines = [escapeLabel(element.name)];
  const meta = [element.kind, element.role].filter(Boolean).join(" · ");
  if (element.technology) lines.push(`[${escapeLabel(element.technology)}]`);
  if (meta) lines.push(meta);
  return lines.join("<br/>");
}

function edgeLabel(relationship: ArchitectureRelationship): string {
  const parts: string[] = [];
  if (relationship.description) parts.push(escapeLabel(relationship.description));
  if (relationship.technology) parts.push(`[${escapeLabel(relationship.technology)}]`);
  return parts.join(" ");
}

const arrow = (style: ArchitectureRelationship["interactionStyle"]): string =>
  style === "async" || style === "event" ? "-.->" : "-->";

/**
 * Mermaid is generated from the semantic model (optionally narrowed to a
 * view) — never from React Flow state.
 */
export function toMermaid(
  document: WorkspaceDocument,
  options: { view?: ViewDetail; direction?: "LR" | "TB" } = {},
): string {
  const direction = options.direction ?? "LR";
  const view = options.view;

  let elements = document.elements;
  let relationships = document.relationships;

  if (view) {
    const visible = new Set(
      view.elements.filter((entry) => !entry.hidden).map((entry) => entry.elementId),
    );
    const hiddenRelationships = new Set(
      view.relationships.filter((entry) => entry.hidden).map((entry) => entry.relationshipId),
    );
    // Relationships between hidden descendants are lifted to their visible ancestors.
    relationships = resolveRelationshipsForView(
      elements,
      relationships.filter((relationship) => !hiddenRelationships.has(relationship.id)),
      visible,
    ).map((edge) => {
      const first = edge.relationships[0] as ArchitectureRelationship;
      return {
        ...first,
        id: edge.id,
        sourceElementId: edge.sourceElementId,
        targetElementId: edge.targetElementId,
        description: edge.implied
          ? [...new Set(edge.relationships.map((item) => item.description).filter(Boolean))].join(
              ", ",
            )
          : first.description,
      };
    });
    elements = elements.filter((element) => visible.has(element.id));
  }

  const visibleIds = new Set(elements.map((element) => element.id));
  const lines: string[] = [`flowchart ${direction}`];
  const rendered = new Set<string>();
  const renderedBoundaries = new Set<string>();

  const childrenOf = (parentId: string | null): ArchitectureElement[] =>
    elements.filter((element) => (element.parentId ?? null) === parentId);

  const renderElement = (element: ArchitectureElement, indent: string): void => {
    if (rendered.has(element.id)) return;
    rendered.add(element.id);
    const children = childrenOf(element.id);
    if (children.length > 0) {
      lines.push(`${indent}subgraph ${nodeId(element.id)}_group["${escapeLabel(element.name)}"]`);
      lines.push(`${indent}  direction ${direction}`);
      for (const child of children) renderElement(child, `${indent}  `);
      lines.push(`${indent}end`);
    } else {
      const shape = element.kind === "person" ? ["([", "])"] : ["[", "]"];
      lines.push(`${indent}${nodeId(element.id)}${shape[0]}"${elementLabel(element)}"${shape[1]}`);
    }
  };

  const nestedBoundaries = document.views.flatMap((candidate) => candidate.boundaries);
  const allBoundaries =
    nestedBoundaries.length > 0 ? nestedBoundaries : (document.boundaries ?? []);
  const activeBoundaries = view
    ? allBoundaries.filter(
        (boundary) => boundary.viewId === view.id && boundary.layer === view.settings.boundaryLayer,
      )
    : [];
  const boundaryIds = new Set(activeBoundaries.map((boundary) => boundary.id));
  const renderBoundary = (boundary: ArchitectureBoundary, indent: string): void => {
    if (renderedBoundaries.has(boundary.id)) return;
    renderedBoundaries.add(boundary.id);
    lines.push(
      `${indent}subgraph ${nodeId(`boundary_${boundary.id}`)}["${escapeLabel(boundary.name)}"]`,
    );
    lines.push(`${indent}  direction ${direction}`);
    for (const child of activeBoundaries.filter(
      (candidate) => candidate.parentBoundaryId === boundary.id,
    )) {
      renderBoundary(child, `${indent}  `);
    }
    for (const elementId of boundary.elementIds) {
      const element = elements.find((candidate) => candidate.id === elementId);
      if (element) renderElement(element, `${indent}  `);
    }
    lines.push(`${indent}end`);
  };

  for (const boundary of activeBoundaries) {
    if (!boundary.parentBoundaryId || !boundaryIds.has(boundary.parentBoundaryId)) {
      renderBoundary(boundary, "  ");
    }
  }

  for (const element of elements) {
    const parentVisible = element.parentId ? visibleIds.has(element.parentId) : false;
    if (!parentVisible) renderElement(element, "  ");
  }
  for (const element of elements) renderElement(element, "  ");

  for (const relationship of relationships) {
    const label = edgeLabel(relationship);
    const connector = label
      ? `${arrow(relationship.interactionStyle)}|"${label}"|`
      : arrow(relationship.interactionStyle);
    lines.push(
      `  ${nodeId(relationship.sourceElementId)} ${connector} ${nodeId(relationship.targetElementId)}`,
    );
  }

  return lines.join("\n");
}

/** Human-readable, token-efficient rendering of the model for AI clients. */
export function toOutline(document: WorkspaceDocument): string {
  const lines: string[] = [`# ${document.workspace.name}`];
  if (document.workspace.description) lines.push(document.workspace.description);

  const childrenOf = (parentId: string | null): ArchitectureElement[] =>
    document.elements.filter((element) => (element.parentId ?? null) === parentId);

  const render = (element: ArchitectureElement, depth: number): void => {
    const indent = "  ".repeat(depth);
    const meta = [
      element.kind,
      element.role,
      element.technology,
      element.external ? "external" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`${indent}- ${element.name} (${meta}) [${element.id}]`);
    for (const child of childrenOf(element.id)) render(child, depth + 1);
  };

  lines.push("", "## Elements");
  for (const element of childrenOf(null)) render(element, 0);

  const nestedBoundaries = document.views.flatMap((view) => view.boundaries);
  const boundaries = nestedBoundaries.length > 0 ? nestedBoundaries : (document.boundaries ?? []);
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const renderBoundary = (
    boundary: ArchitectureBoundary,
    candidates: readonly ArchitectureBoundary[],
    depth: number,
  ): void => {
    const indent = "  ".repeat(depth);
    const classification = boundary.classification ? ` · ${boundary.classification}` : "";
    lines.push(
      `${indent}- ${boundary.name} (${boundary.kind} · ${boundary.layer}${classification}) [${boundary.id}]`,
    );
    for (const elementId of boundary.elementIds) {
      lines.push(`${indent}  - member: ${elementsById.get(elementId)?.name ?? elementId}`);
    }
    for (const child of candidates.filter(
      (candidate) => candidate.parentBoundaryId === boundary.id,
    )) {
      renderBoundary(child, candidates, depth + 1);
    }
  };

  lines.push("", "## Relationships");
  const byId = new Map(document.elements.map((element) => [element.id, element]));
  for (const relationship of document.relationships) {
    const source = byId.get(relationship.sourceElementId)?.name ?? relationship.sourceElementId;
    const target = byId.get(relationship.targetElementId)?.name ?? relationship.targetElementId;
    const meta = [relationship.interactionStyle, relationship.technology]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      `- ${source} → ${target}: ${relationship.description ?? "(no description)"} (${meta})`,
    );
  }

  lines.push("", "## Views");
  for (const view of document.views) {
    lines.push(`- ${view.name} (${view.kind}, key=${view.key}) — ${view.elements.length} elements`);
    const viewBoundaries = boundaries.filter((boundary) => boundary.viewId === view.id);
    const boundaryIds = new Set(viewBoundaries.map((boundary) => boundary.id));
    for (const boundary of viewBoundaries) {
      if (!boundary.parentBoundaryId || !boundaryIds.has(boundary.parentBoundaryId)) {
        renderBoundary(boundary, viewBoundaries, 1);
      }
    }
  }

  if (document.records.length > 0) {
    lines.push("", "## Records");
    for (const record of document.records) {
      lines.push(
        `- [${record.kind.toUpperCase()}] ${record.title}${record.severity ? ` (severity: ${record.severity})` : ""}`,
      );
    }
  }

  return lines.join("\n");
}
