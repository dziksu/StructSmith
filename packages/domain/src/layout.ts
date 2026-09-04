import dagre from "@dagrejs/dagre";
import type { LayoutDirection } from "@structsmith/contracts";

export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 96;

/** Must match the edge label chip in the web UI. */
const LABEL_MAX_WIDTH = 170;
const LABEL_CHAR_WIDTH = 5.4;
const LABEL_LINE_HEIGHT = 13;
const LABEL_MAX_LINES = 3;
const LABEL_PADDING_X = 12;
const LABEL_PADDING_Y = 8;

export interface LayoutNode {
  id: string;
  width?: number | null;
  height?: number | null;
  /** Parent id — only honoured when the parent is part of the same layout. */
  parentId?: string | null;
}

export interface LayoutEdge {
  source: string;
  target: string;
  /** Edge label text. Its box is reserved in the layout so labels do not
   *  end up underneath a node. */
  label?: string;
}

export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
}

const clusterId = (parentId: string): string => `cluster:${parentId}`;

export interface LabelBox {
  width: number;
  height: number;
}

export function estimateLabelSize(label: string | undefined): LabelBox | null {
  const text = label?.trim();
  if (!text) return null;

  const naturalWidth = text.length * LABEL_CHAR_WIDTH;
  const lines = Math.min(LABEL_MAX_LINES, Math.max(1, Math.ceil(naturalWidth / LABEL_MAX_WIDTH)));

  return {
    width: Math.round(Math.min(naturalWidth, LABEL_MAX_WIDTH) + LABEL_PADDING_X),
    height: lines * LABEL_LINE_HEIGHT + LABEL_PADDING_Y,
  };
}

/**
 * Pure layout helper shared by the server (MCP `view_auto_layout`) and the
 * browser. It only produces coordinates — never touches the semantic model.
 */
export function computeLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  direction: LayoutDirection = "LR",
): LayoutPosition[] {
  if (nodes.length === 0) return [];

  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setGraph({
    rankdir: direction,
    // Edge labels are reserved as their own boxes below, and dagre adds ranksep
    // on both sides of them — so this stays small to keep diagrams compact.
    nodesep: 72,
    ranksep: 80,
    edgesep: 24,
    marginx: 48,
    marginy: 48,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const present = new Set(nodes.map((node) => node.id));

  // A parent that is not itself on the view is still drawn as a boundary around
  // its children, so it needs a cluster here too — otherwise dagre spreads the
  // children across ranks and unrelated nodes land inside the boundary.
  const detachedParents = new Set(
    nodes
      .map((node) => node.parentId)
      .filter((parentId): parentId is string => Boolean(parentId))
      .filter((parentId) => !present.has(parentId)),
  );

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    });
  }
  for (const parentId of detachedParents) {
    graph.setNode(clusterId(parentId), {});
  }
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (present.has(node.parentId)) {
      graph.setParent(node.id, node.parentId);
    } else if (detachedParents.has(node.parentId)) {
      graph.setParent(node.id, clusterId(node.parentId));
    }
  }
  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target) || edge.source === edge.target) {
      continue;
    }
    const label = estimateLabelSize(edge.label);
    graph.setEdge(
      edge.source,
      edge.target,
      label ? { width: label.width, height: label.height, labelpos: "c" } : {},
    );
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const laid = graph.node(node.id) as { x: number; y: number } | undefined;
    const width = node.width ?? DEFAULT_NODE_WIDTH;
    const height = node.height ?? DEFAULT_NODE_HEIGHT;
    return {
      id: node.id,
      x: Math.round((laid?.x ?? 0) - width / 2),
      y: Math.round((laid?.y ?? 0) - height / 2),
    };
  });
}
