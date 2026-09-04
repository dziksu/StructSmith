import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ViewDetail,
} from "@structsmith/contracts";
import { edgeLabel, resolveRelationshipsForView } from "@structsmith/domain";
import type { Edge, Node } from "@xyflow/react";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;
const BOUNDARY_PADDING = 28;
const BOUNDARY_HEADER = 26;

export interface ElementNodeData extends Record<string, unknown> {
  element: ArchitectureElement;
  severity: "high" | "critical" | null;
  locked: boolean;
}

export interface BoundaryNodeData extends Record<string, unknown> {
  element: ArchitectureElement;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  /** The relationship to select and edit when this edge is picked. */
  relationship: ArchitectureRelationship;
  /** True when the edge stands in for relationships between hidden descendants. */
  implied: boolean;
  label: string;
  count: number;
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
    nodes.push({
      id: element.id,
      type: "element",
      position: { x: entry.x, y: entry.y },
      draggable: !entry.locked,
      data: { element, severity: severities.get(element.id) ?? null, locked: entry.locked },
      zIndex: entry.zIndex,
      width: entry.width ?? NODE_WIDTH,
      height: entry.height ?? NODE_HEIGHT,
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
      selectable: unambiguous,
      deletable: unambiguous,
      data: {
        relationship: first,
        implied: edge.implied,
        label,
        count: edge.relationships.length,
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

/**
 * Boundaries are derived from live node positions so they follow a drag
 * immediately (spec §34). They are never persisted — a boundary is just the
 * footprint of a parent element whose children are on the view.
 */
export function computeBoundaries(
  sources: readonly BoundarySource[],
  elementsById: ReadonlyMap<string, ArchitectureElement>,
  enabled: boolean,
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
      data: { element: parent },
      draggable: false,
      selectable: true,
      connectable: false,
      deletable: false,
      zIndex: -1,
      style: {
        width: maxX - minX + BOUNDARY_PADDING * 2,
        height: maxY - minY + BOUNDARY_PADDING * 2 + BOUNDARY_HEADER,
      },
    });
  }
  return nodes;
}

export const isBoundaryId = (id: string): boolean => id.startsWith("boundary:");
export const boundaryElementId = (id: string): string => id.slice("boundary:".length);
