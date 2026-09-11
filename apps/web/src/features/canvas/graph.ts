import type {
  ArchitectureBoundary,
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ViewDetail,
} from "@structsmith/contracts";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  edgeLabel,
  estimateElementSize,
  resolveRelationshipsForView,
} from "@structsmith/domain";
import type { Edge, Node } from "@xyflow/react";

export const NODE_WIDTH = DEFAULT_NODE_WIDTH;
export const NODE_HEIGHT = DEFAULT_NODE_HEIGHT;
export const BOUNDARY_PADDING = 28;
export const BOUNDARY_HEADER = 36;

export interface ElementNodeData extends Record<string, unknown> {
  element: ArchitectureElement;
  severity: "high" | "critical" | null;
  locked: boolean;
  showFullTitles: boolean;
  showDescriptions: boolean;
  minimumHeight: number;
}

export interface BoundaryNodeData extends Record<string, unknown> {
  name: string;
  layer?: ArchitectureBoundary["layer"];
  kind?: ArchitectureElement["kind"];
  classification: "public" | "restricted" | "private" | null;
  boundaryId?: string;
  elementId?: string;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  /** The relationship to select and edit when this edge is picked. */
  relationship: ArchitectureRelationship;
  /** True when the edge stands in for relationships between hidden descendants. */
  implied: boolean;
  label: string;
  count: number;
  routing: ViewDetail["settings"]["relationshipRouting"];
  showLabel: boolean;
}

export type FlowNode = Node<ElementNodeData, "element"> | Node<BoundaryNodeData, "boundary">;
export type FlowEdge = Edge<RelationshipEdgeData>;

interface BuildInput {
  view: ViewDetail;
  elements: readonly ArchitectureElement[];
  relationships: readonly ArchitectureRelationship[];
  records: readonly ArchitectureRecord[];
}

/** Risk indicators stay subtle — the canvas must not turn into a christmas tree. */
function riskSeverities(records: readonly ArchitectureRecord[]): Map<string, "high" | "critical"> {
  const map = new Map<string, "high" | "critical">();
  for (const record of records) {
    if (record.kind !== "risk") continue;
    if (record.status === "resolved" || record.status === "rejected") continue;
    if (record.severity !== "high" && record.severity !== "critical") continue;
    for (const elementId of record.linkedElementIds) {
      if (record.severity === "critical" || map.get(elementId) !== "critical") {
        map.set(elementId, record.severity);
      }
    }
  }
  return map;
}

/**
 * The single translation step from the semantic model to React Flow. React Flow
 * never owns data — it renders what a view declares visible, where the view
 * says it is.
 */
export function buildGraph({ view, elements, relationships, records }: BuildInput): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  hiddenCount: number;
} {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const placements = view.elements.filter((entry) => byId.has(entry.elementId));
  const visible = placements.filter((entry) => !entry.hidden);
  const visibleIds = new Set(visible.map((entry) => entry.elementId));
  const severities = riskSeverities(records);

  const nodes: FlowNode[] = [];
  for (const entry of visible) {
    const element = byId.get(entry.elementId);
    if (!element) continue;
    const size = estimateElementSize(element, view.settings, entry);
    const expanded = view.settings.showFullTitles || view.settings.showDescriptions;
    nodes.push({
      id: element.id,
      type: "element",
      position: { x: entry.x, y: entry.y },
      draggable: !entry.locked,
      data: {
        element,
        severity: severities.get(element.id) ?? null,
        locked: entry.locked,
        showFullTitles: view.settings.showFullTitles,
        showDescriptions: view.settings.showDescriptions,
        minimumHeight: size.height,
      },
      // Keep semantic boundaries above the canvas background, relationship
      // paths above their fills, and cards above both.
      zIndex: 20 + entry.zIndex,
      width: size.width,
      height: expanded ? undefined : size.height,
      style: expanded ? { minHeight: size.height } : undefined,
    });
  }

  const hiddenRelationships = new Set(
    view.relationships.filter((entry) => entry.hidden).map((entry) => entry.relationshipId),
  );

  const edges: FlowEdge[] = resolveRelationshipsForView(
    elements,
    relationships.filter((relationship) => !hiddenRelationships.has(relationship.id)),
    visibleIds,
  ).map((edge) => {
    const first = edge.relationships[0] as ArchitectureRelationship;
    const label = edgeLabel(edge);
    // An implied edge that stands for exactly one relationship is still
    // unambiguous, so it stays selectable and editable; only a merged edge
    // (several relationships behind one line) is not.
    const unambiguous = edge.relationships.length === 1;
    return {
      id: edge.id,
      type: "relationship",
      source: edge.sourceElementId,
      target: edge.targetElementId,
      sourceHandle: view.settings.autoLayoutDirection === "TB" ? "b" : undefined,
      targetHandle: view.settings.autoLayoutDirection === "TB" ? "t" : undefined,
      selectable: unambiguous,
      deletable: unambiguous,
      zIndex: 10,
      data: {
        relationship: first,
        implied: edge.implied,
        label,
        count: edge.relationships.length,
        routing: view.settings.relationshipRouting,
        showLabel: view.settings.showRelationshipLabels,
      },
    };
  });

  return { nodes, edges, hiddenCount: placements.length - visible.length };
}

export interface BoundarySource {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NestedBoundarySource extends BoundarySource {
  elementIds: readonly string[];
}

function boundaryStyle(
  classification: ArchitectureBoundary["classification"],
  width: number,
  height: number,
): Record<string, string | number> {
  const accent =
    classification === "public"
      ? "var(--ownership-external)"
      : classification === "private"
        ? "var(--ownership-internal)"
        : "var(--boundary)";
  return {
    width,
    height,
    border: `1px solid color-mix(in oklch, ${accent} 45%, var(--canvas))`,
    borderRadius: 12,
    backgroundColor: `color-mix(in srgb, ${accent} 8%, transparent)`,
  };
}

/**
 * Boundaries are derived from live node positions so they follow a drag
 * immediately (spec §34). They are never persisted — a boundary is just the
 * footprint of a parent element whose children are on the view.
 */
export function computeBoundaries(
  sources: readonly BoundarySource[],
  elementsById: ReadonlyMap<string, ArchitectureElement>,
  enabled: boolean,
  nestedBoundaries: readonly NestedBoundarySource[] = [],
): FlowNode[] {
  if (!enabled) return [];

  const present = new Set(sources.map((source) => source.id));
  const groups = new Map<string, BoundarySource[]>();

  for (const source of sources) {
    const parentId = elementsById.get(source.id)?.parentId;
    if (!parentId || present.has(parentId)) continue;
    const bucket = groups.get(parentId);
    if (bucket) bucket.push(source);
    else groups.set(parentId, [source]);
  }

  // A semantic boundary can sit inside a parent-element frame. Include the
  // entire nested rectangle in that parent's footprint, rather than deriving
  // both frames independently from the same cards and overlapping headers.
  for (const boundary of nestedBoundaries) {
    const parentIds = new Set(
      boundary.elementIds
        .map((elementId) => elementsById.get(elementId)?.parentId)
        .filter(
          (parentId): parentId is string =>
            parentId !== null && parentId !== undefined && !present.has(parentId),
        ),
    );
    for (const parentId of parentIds) {
      const bucket = groups.get(parentId);
      if (bucket) {
        if (!bucket.some((source) => source.id === boundary.id)) bucket.push(boundary);
      } else {
        groups.set(parentId, [boundary]);
      }
    }
  }

  const nodes: FlowNode[] = [];
  for (const [parentId, children] of groups) {
    const parent = elementsById.get(parentId);
    if (!parent || children.length === 0) continue;

    const minX = Math.min(...children.map((child) => child.x));
    const minY = Math.min(...children.map((child) => child.y));
    const maxX = Math.max(...children.map((child) => child.x + child.width));
    const maxY = Math.max(...children.map((child) => child.y + child.height));

    nodes.push({
      id: `boundary:${parentId}`,
      type: "boundary",
      position: { x: minX - BOUNDARY_PADDING, y: minY - BOUNDARY_PADDING - BOUNDARY_HEADER },
      width: maxX - minX + BOUNDARY_PADDING * 2,
      height: maxY - minY + BOUNDARY_PADDING * 2 + BOUNDARY_HEADER,
      data: {
        name: parent.name,
        kind: parent.kind,
        classification: parent.external ? "public" : null,
        elementId: parent.id,
      },
      draggable: false,
      // Derived containers are clickable through Canvas.onNodeClick, but must
      // stay out of React Flow's rectangle/multi-selection of real elements.
      selectable: false,
      connectable: false,
      deletable: false,
      zIndex: 0,
      style: boundaryStyle(
        parent.external ? "public" : null,
        maxX - minX + BOUNDARY_PADDING * 2,
        maxY - minY + BOUNDARY_PADDING * 2 + BOUNDARY_HEADER,
      ),
    });
  }
  return nodes;
}

/** Build nested semantic boundary rectangles from visible member footprints. */
export function computeSemanticBoundaries(
  sources: readonly BoundarySource[],
  boundaries: readonly ArchitectureBoundary[],
  layer: ArchitectureBoundary["layer"],
  enabled: boolean,
): FlowNode[] {
  if (!enabled) return [];
  const active = boundaries.filter((boundary) => boundary.layer === layer);
  const byId = new Map(active.map((boundary) => [boundary.id, boundary] as const));
  const sourceById = new Map(sources.map((source) => [source.id, source] as const));
  const boxes = new Map<string, BoundarySource>();

  const boxFor = (
    boundary: ArchitectureBoundary,
    visiting = new Set<string>(),
  ): BoundarySource | null => {
    const cached = boxes.get(boundary.id);
    if (cached) return cached;
    if (visiting.has(boundary.id)) return null;
    visiting.add(boundary.id);
    const contents: BoundarySource[] = boundary.elementIds
      .map((id) => sourceById.get(id))
      .filter((source): source is BoundarySource => Boolean(source));
    for (const child of active.filter((item) => item.parentBoundaryId === boundary.id)) {
      const childBox = boxFor(child, visiting);
      if (childBox) contents.push(childBox);
    }
    visiting.delete(boundary.id);
    if (contents.length === 0) return null;
    const minX = Math.min(...contents.map((item) => item.x));
    const minY = Math.min(...contents.map((item) => item.y));
    const maxX = Math.max(...contents.map((item) => item.x + item.width));
    const maxY = Math.max(...contents.map((item) => item.y + item.height));
    const box = {
      id: boundary.id,
      x: minX - BOUNDARY_PADDING,
      y: minY - BOUNDARY_PADDING - BOUNDARY_HEADER,
      width: maxX - minX + BOUNDARY_PADDING * 2,
      height: maxY - minY + BOUNDARY_PADDING * 2 + BOUNDARY_HEADER,
    };
    boxes.set(boundary.id, box);
    return box;
  };

  for (const boundary of active) boxFor(boundary);
  const depthOf = (boundary: ArchitectureBoundary): number => {
    let depth = 0;
    let parent = boundary.parentBoundaryId ? byId.get(boundary.parentBoundaryId) : undefined;
    while (parent) {
      depth += 1;
      parent = parent.parentBoundaryId ? byId.get(parent.parentBoundaryId) : undefined;
    }
    return depth;
  };

  return active.flatMap((boundary) => {
    const box = boxes.get(boundary.id);
    if (!box) return [];
    const depth = depthOf(boundary);
    return [
      {
        id: `boundary:${boundary.id}`,
        type: "boundary" as const,
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        data: {
          name: boundary.name,
          layer: boundary.layer,
          classification: boundary.classification,
          boundaryId: boundary.id,
        },
        draggable: false,
        // Boundary boxes are view-owned containers, not blocks in a group
        // selection. Canvas.onNodeClick still opens their inspector.
        selectable: false,
        connectable: false,
        deletable: false,
        // Parent-element frames use zero. Semantic boundaries sit above them,
        // and each nested semantic level sits above its parent.
        zIndex: depth + 1,
        style: boundaryStyle(boundary.classification, box.width, box.height),
      },
    ];
  });
}

/** Compute both boundary systems together so their boxes form one visual hierarchy. */
export function computeCanvasBoundaries(
  sources: readonly BoundarySource[],
  elementsById: ReadonlyMap<string, ArchitectureElement>,
  boundaries: readonly ArchitectureBoundary[],
  layer: ArchitectureBoundary["layer"],
  enabled: boolean,
): { parentBoundaries: FlowNode[]; semanticBoundaries: FlowNode[] } {
  const semanticBoundaries = computeSemanticBoundaries(sources, boundaries, layer, enabled);
  if (!enabled) return { parentBoundaries: [], semanticBoundaries };

  const active = boundaries.filter((boundary) => boundary.layer === layer);
  const children = new Map<string, ArchitectureBoundary[]>();
  for (const boundary of active) {
    if (!boundary.parentBoundaryId) continue;
    const bucket = children.get(boundary.parentBoundaryId);
    if (bucket) bucket.push(boundary);
    else children.set(boundary.parentBoundaryId, [boundary]);
  }

  const members = new Map<string, Set<string>>();
  const memberIds = (boundaryId: string, visiting = new Set<string>()): Set<string> => {
    const cached = members.get(boundaryId);
    if (cached) return cached;
    if (visiting.has(boundaryId)) return new Set();
    visiting.add(boundaryId);
    const boundary = active.find((candidate) => candidate.id === boundaryId);
    const result = new Set(boundary?.elementIds ?? []);
    for (const child of children.get(boundaryId) ?? []) {
      for (const elementId of memberIds(child.id, visiting)) result.add(elementId);
    }
    visiting.delete(boundaryId);
    members.set(boundaryId, result);
    return result;
  };

  const nestedBoundaries = semanticBoundaries.flatMap((node): NestedBoundarySource[] => {
    const boundaryId = node.data.boundaryId;
    if (!boundaryId || node.width === undefined || node.height === undefined) return [];
    return [
      {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
        elementIds: [...memberIds(String(boundaryId))],
      },
    ];
  });

  return {
    parentBoundaries: computeBoundaries(sources, elementsById, enabled, nestedBoundaries),
    semanticBoundaries,
  };
}

export const isBoundaryId = (id: string): boolean => id.startsWith("boundary:");
export const boundaryElementId = (id: string): string => id.slice("boundary:".length);
