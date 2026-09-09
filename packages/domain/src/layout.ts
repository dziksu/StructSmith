import dagre from "@dagrejs/dagre";
import type {
  ArchitectureElement,
  LayoutAlgorithm,
  LayoutDirection,
  ViewSettings,
} from "@structsmith/contracts";

export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 96;
const BASE_NODE_GAP = 96;

/** Word wrapping estimate for layout without a browser; explicit line breaks are preserved. */
function wrappedLines(text: string, width: number, characterWidth: number): number {
  const columns = Math.max(1, Math.floor(width / characterWidth));
  return text.split(/\r?\n/).reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      if (used > 0 && used + 1 + word.length > columns) {
        lines += 1;
        used = 0;
      }
      if (used > 0) used += 1;
      lines += Math.floor((word.length - 1) / columns);
      used += ((word.length - 1) % columns) + 1;
    }
    return total + lines;
  }, 0);
}

/**
 * Reserve room for expanded cards in both server layout and the canvas. The UI
 * can grow beyond this estimate for font differences; saved sizes stay intact.
 */
export function estimateElementSize(
  element: Pick<ArchitectureElement, "name" | "description" | "technology"> | undefined,
  settings: Pick<ViewSettings, "showFullTitles" | "showDescriptions">,
  size: { width?: number | null; height?: number | null; locked?: boolean } = {},
): { width: number; height: number } {
  const width = size.width ?? DEFAULT_NODE_WIDTH;
  const minimumHeight = size.height ?? DEFAULT_NODE_HEIGHT;
  if (!element || (!settings.showFullTitles && !settings.showDescriptions)) {
    return { width, height: minimumHeight };
  }

  // Horizontal padding, ownership stripe, icon and space for status indicators.
  const titleWidth = width - 82 - (size.locked ? 20 : 0);
  const titleLines = settings.showFullTitles
    ? wrappedLines(element.name.replace(/\s+/g, " "), titleWidth, 7.5)
    : 1;
  const headerHeight = Math.max(24, titleLines * 16 + (element.technology ? 16 : 0));
  const description = settings.showDescriptions ? element.description?.trim() : null;
  const descriptionHeight = description ? 8 + wrappedLines(description, width - 30, 6) * 16 : 0;
  // Vertical padding/borders (22), footer gap (8) and ownership badge (20).
  return { width, height: Math.max(minimumHeight, 50 + headerHeight + descriptionHeight) };
}

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
  x?: number;
  y?: number;
  locked?: boolean;
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
  algorithm: LayoutAlgorithm = "dagre",
  rootElementId?: string,
): LayoutPosition[] {
  if (nodes.length === 0) return [];

  if (algorithm === "force") return computeForceLayout(nodes, edges);
  if (algorithm === "radial") return computeRadialLayout(nodes, edges, rootElementId);
  if (algorithm === "grid") return computeGridLayout(nodes);

  return computeDagreLayout(nodes, edges, direction);
}

function dimensions(node: LayoutNode): { width: number; height: number } {
  return {
    width: node.width ?? DEFAULT_NODE_WIDTH,
    height: node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

function normalizePositions(
  positions: LayoutPosition[],
  nodes: readonly LayoutNode[],
  margin = 48,
): LayoutPosition[] {
  if (nodes.some((node) => node.locked)) return positions;
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  return positions.map((position) => ({
    id: position.id,
    x: Math.round(position.x - minX + margin),
    y: Math.round(position.y - minY + margin),
  }));
}

function computeDagreLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  direction: LayoutDirection,
): LayoutPosition[] {
  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setGraph({
    rankdir: direction,
    // Edge labels are reserved as their own boxes below, and dagre adds ranksep
    // on both sides of them — so this stays small to keep diagrams compact.
    nodesep: BASE_NODE_GAP,
    ranksep: 116,
    edgesep: 36,
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

interface ForceNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  locked: boolean;
}

/** Deterministic, finite force simulation. It never animates or mutates input. */
function computeForceLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): LayoutPosition[] {
  const count = nodes.length;
  const radius = Math.max(220, count * 34);
  const state: ForceNode[] = nodes.map((node, index) => {
    const { width, height } = dimensions(node);
    const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: node.id,
      width,
      height,
      x: node.x ?? Math.cos(angle) * radius,
      y: node.y ?? Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      locked: node.locked ?? false,
    };
  });
  const byId = new Map(state.map((node) => [node.id, node] as const));
  const links = edges
    .map((edge) => [byId.get(edge.source), byId.get(edge.target)] as const)
    .filter((link): link is readonly [ForceNode, ForceNode] => Boolean(link[0] && link[1]));

  for (let iteration = 0; iteration < 280; iteration += 1) {
    const cooling = 1 - iteration / 320;
    for (let leftIndex = 0; leftIndex < state.length; leftIndex += 1) {
      const left = state[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < state.length; rightIndex += 1) {
        const right = state[rightIndex];
        if (!right) continue;
        let dx = right.x + right.width / 2 - (left.x + left.width / 2);
        let dy = right.y + right.height / 2 - (left.y + left.height / 2);
        if (dx === 0 && dy === 0) {
          const angle = ((leftIndex + 1) * 2.399963) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        }
        const distanceSquared = Math.max(100, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const push = Math.min(18, 72_000 / distanceSquared) * cooling;
        const fx = (dx / distance) * push;
        const fy = (dy / distance) * push;
        if (!left.locked) {
          left.vx -= fx;
          left.vy -= fy;
        }
        if (!right.locked) {
          right.vx += fx;
          right.vy += fy;
        }
      }
    }

    for (const [source, target] of links) {
      const dx = target.x + target.width / 2 - (source.x + source.width / 2);
      const dy = target.y + target.height / 2 - (source.y + source.height / 2);
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired =
        170 +
        (Math.hypot(source.width, source.height) + Math.hypot(target.width, target.height)) / 4;
      const pull = (distance - desired) * 0.012 * cooling;
      const fx = (dx / distance) * pull;
      const fy = (dy / distance) * pull;
      if (!source.locked) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.locked) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    const centerX = state.reduce((sum, node) => sum + node.x + node.width / 2, 0) / count;
    const centerY = state.reduce((sum, node) => sum + node.y + node.height / 2, 0) / count;
    for (const node of state) {
      if (node.locked) continue;
      node.vx += (centerX - node.x - node.width / 2) * 0.002;
      node.vy += (centerY - node.y - node.height / 2) * 0.002;
      node.vx = Math.max(-24, Math.min(24, node.vx * 0.72));
      node.vy = Math.max(-24, Math.min(24, node.vy * 0.72));
      node.x += node.vx;
      node.y += node.vy;
    }
    resolveRectangleCollisions(state, 72);
  }

  return normalizePositions(
    state.map((node) => ({ id: node.id, x: node.x, y: node.y })),
    nodes,
  );
}

function resolveRectangleCollisions(nodes: ForceNode[], gap: number): void {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      if (!right) continue;
      const leftCx = left.x + left.width / 2;
      const leftCy = left.y + left.height / 2;
      const rightCx = right.x + right.width / 2;
      const rightCy = right.y + right.height / 2;
      const overlapX = (left.width + right.width) / 2 + gap - Math.abs(rightCx - leftCx);
      const overlapY = (left.height + right.height) / 2 + gap - Math.abs(rightCy - leftCy);
      if (overlapX <= 0 || overlapY <= 0 || (left.locked && right.locked)) continue;

      const moveLeft = right.locked ? 1 : left.locked ? 0 : 0.5;
      const moveRight = left.locked ? 1 : right.locked ? 0 : 0.5;
      if (overlapX < overlapY) {
        const sign = rightCx >= leftCx ? 1 : -1;
        left.x -= sign * overlapX * moveLeft;
        right.x += sign * overlapX * moveRight;
      } else {
        const sign = rightCy >= leftCy ? 1 : -1;
        left.y -= sign * overlapY * moveLeft;
        right.y += sign * overlapY * moveRight;
      }
    }
  }
}

function computeRadialLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  requestedRoot?: string,
): LayoutPosition[] {
  const present = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()] as const));
  for (const edge of edges) {
    if (!present.has(edge.source) || !present.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const root =
    (requestedRoot && present.has(requestedRoot) ? requestedRoot : undefined) ??
    [...nodes].sort(
      (left, right) =>
        (adjacency.get(right.id)?.size ?? 0) - (adjacency.get(left.id)?.size ?? 0) ||
        left.id.localeCompare(right.id),
    )[0]?.id;
  if (!root) return [];

  const distance = new Map<string, number>([[root, 0]]);
  const queue = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const neighbor of [...(adjacency.get(current) ?? [])].sort()) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, (distance.get(current) ?? 0) + 1);
      queue.push(neighbor);
    }
  }
  let outerRing = Math.max(0, ...distance.values());
  for (const node of nodes) {
    if (!distance.has(node.id)) distance.set(node.id, ++outerRing);
  }

  const rings = new Map<number, LayoutNode[]>();
  for (const node of nodes) {
    const ring = distance.get(node.id) ?? 0;
    rings.set(ring, [...(rings.get(ring) ?? []), node]);
  }
  const positions: LayoutPosition[] = [];
  let radius = 0;
  for (const [ring, ringNodes] of [...rings.entries()].sort(([a], [b]) => a - b)) {
    const ordered = [...ringNodes].sort((a, b) => a.id.localeCompare(b.id));
    const maxSize = Math.max(
      ...ordered.map((node) => Math.max(dimensions(node).width, dimensions(node).height)),
    );
    if (ring > 0) {
      const circumferenceRadius =
        ordered.reduce((sum, node) => sum + dimensions(node).width + BASE_NODE_GAP, 0) /
        (Math.PI * 2);
      radius = Math.max(radius + maxSize + 140, circumferenceRadius);
    }
    ordered.forEach((node, index) => {
      const { width, height } = dimensions(node);
      const angle =
        ordered.length === 1 ? -Math.PI / 2 : (index / ordered.length) * Math.PI * 2 - Math.PI / 2;
      positions.push({
        id: node.id,
        x: Math.cos(angle) * radius - width / 2,
        y: Math.sin(angle) * radius - height / 2,
      });
    });
  }
  return normalizePositions(positions, nodes);
}

function computeGridLayout(nodes: readonly LayoutNode[]): LayoutPosition[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = BASE_NODE_GAP;
  const gapY = BASE_NODE_GAP;
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rows = Math.ceil(nodes.length / columns);
  const rowHeights = Array.from({ length: rows }, () => 0);
  nodes.forEach((node, index) => {
    const { width, height } = dimensions(node);
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
  });
  const columnX = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((sum, width) => sum + width + gapX, 48),
  );
  const rowY = rowHeights.map((_, index) =>
    rowHeights.slice(0, index).reduce((sum, height) => sum + height + gapY, 48),
  );
  return nodes.map((node, index) => ({
    id: node.id,
    x: columnX[index % columns] ?? 48,
    y: rowY[Math.floor(index / columns)] ?? 48,
  }));
}
