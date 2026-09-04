import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ViewDetail,
} from "@structsmith/contracts";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type EdgeChange,
  MiniMap,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useApiErrorHandler, useApplyOperations } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { invalidateWorkspace } from "@/lib/query";
import { useEditorStore } from "@/store/editor";
import { useHistoryStore } from "@/store/history";
import { BoundaryNode } from "./BoundaryNode";
import { ElementNode } from "./ElementNode";
import {
  boundaryElementId,
  buildGraph,
  computeBoundaries,
  type FlowEdge,
  type FlowNode,
  isBoundaryId,
  NODE_HEIGHT,
  NODE_WIDTH,
  type RelationshipEdgeData,
} from "./graph";
import { type ContextMenuItem, NodeContextMenu } from "./NodeContextMenu";
import { RelationshipEdge } from "./RelationshipEdge";

/** An implied edge carries a derived id, so always resolve the real one. */
const relationshipIdOf = (edge: { id: string; data?: Record<string, unknown> }): string =>
  (edge.data as RelationshipEdgeData | undefined)?.relationship.id ?? edge.id;

const nodeTypes = { element: ElementNode, boundary: BoundaryNode };
const edgeTypes = { relationship: RelationshipEdge };
const LAYOUT_DEBOUNCE_MS = 500;

export const DRAG_MIME = "application/x-architecture-element";

interface CanvasProps {
  workspaceId: string;
  view: ViewDetail;
  elements: readonly ArchitectureElement[];
  relationships: readonly ArchitectureRelationship[];
  records: readonly ArchitectureRecord[];
}

export function Canvas({ workspaceId, view, elements, relationships, records }: CanvasProps) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const onError = useApiErrorHandler();
  const applyOperations = useApplyOperations(workspaceId);
  const pushHistory = useHistoryStore((state) => state.push);

  const select = useEditorStore((state) => state.select);
  const selection = useEditorStore((state) => state.selection);
  const connectFrom = useEditorStore((state) => state.connectFrom);
  const setConnectFrom = useEditorStore((state) => state.setConnectFrom);
  const focusRequest = useEditorStore((state) => state.focusRequest);

  const graph = useMemo(
    () => buildGraph({ view, elements, relationships, records }),
    [view, elements, relationships, records],
  );
  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );

  const [nodes, setNodes] = useState<FlowNode[]>(graph.nodes);
  // React Flow keeps selection *inside* the elements array, so edges must be
  // state with an onEdgesChange handler — a plain prop can never be selected.
  const [edges, setEdges] = useState<FlowEdge[]>(graph.edges);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const pendingLayout = useRef(new Map<string, { x: number; y: number }>());
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A rebuild happens after every mutation; carry the current selection over so
  // the highlight does not blink off while the inspector still shows the item.
  useEffect(() => {
    setNodes((current) => {
      const selected = new Set(current.filter((node) => node.selected).map((node) => node.id));
      return selected.size === 0
        ? graph.nodes
        : graph.nodes.map((node) => (selected.has(node.id) ? { ...node, selected: true } : node));
    });
  }, [graph.nodes]);

  useEffect(() => {
    setEdges((current) => {
      const selected = new Set(current.filter((edge) => edge.selected).map((edge) => edge.id));
      return selected.size === 0
        ? graph.edges
        : graph.edges.map((edge) => (selected.has(edge.id) ? { ...edge, selected: true } : edge));
    });
  }, [graph.edges]);

  /**
   * Fit the diagram once per view, as soon as React Flow has measured the
   * nodes. The `fitView` prop alone runs before the panel layout has settled
   * and before the model query resolves, so entering a workspace from the home
   * screen would otherwise land on an unfitted canvas.
   */
  const nodesInitialized = useNodesInitialized();
  const fittedViewId = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    if (fittedViewId.current === view.id) return;
    fittedViewId.current = view.id;
    void flow.fitView({ padding: 0.25, maxZoom: 1, duration: 250 });
  }, [nodesInitialized, nodes.length, view.id, flow]);

  useEffect(
    () => () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
    },
    [],
  );

  /**
   * Selecting an element outside the canvas (model tree, command palette) has
   * to move the camera *and* mark the node as selected — React Flow keeps
   * `selected` inside the elements array, so the store alone cannot show it.
   */
  useEffect(() => {
    if (!focusRequest) return;
    const { elementId } = focusRequest;

    const node = flow.getNode(elementId);
    if (node) void flow.fitView({ nodes: [{ id: node.id }], duration: 350, maxZoom: 1.2 });

    setNodes((current) =>
      current.map((candidate) => {
        const shouldSelect = candidate.id === elementId;
        return candidate.selected === shouldSelect
          ? candidate
          : { ...candidate, selected: shouldSelect };
      }),
    );
    setEdges((current) =>
      current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
    );
  }, [focusRequest, flow]);

  /* --------------------------- layout persistence --------------------------- */

  const flushLayout = useCallback(() => {
    const entries = [...pendingLayout.current.entries()].map(([elementId, position]) => ({
      elementId,
      x: Math.round(position.x),
      y: Math.round(position.y),
    }));
    pendingLayout.current.clear();
    if (entries.length === 0) return;

    const previous = entries.map(({ elementId }) => {
      const stored = view.elements.find((entry) => entry.elementId === elementId);
      return { elementId, x: stored?.x ?? 0, y: stored?.y ?? 0 };
    });

    api
      .saveLayout(view.id, { entries })
      .then(() => {
        pushHistory({
          kind: "layout",
          viewId: view.id,
          entries: previous,
          label: t("toast.layoutSaved"),
        });
        invalidateWorkspace(workspaceId);
      })
      .catch(onError);
  }, [onError, pushHistory, t, view.elements, view.id, workspaceId]);

  const scheduleLayoutSave = useCallback(() => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current);
    layoutTimer.current = setTimeout(flushLayout, LAYOUT_DEBOUNCE_MS);
  }, [flushLayout]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const relevant = changes.filter(
        (change) => !("id" in change) || !isBoundaryId(change.id as string),
      );
      setNodes((current) => applyNodeChanges(relevant, current) as FlowNode[]);

      for (const change of relevant) {
        if (change.type === "position" && change.position && !change.dragging) {
          pendingLayout.current.set(change.id, change.position);
        }
      }
      if (relevant.some((change) => change.type === "position" && !change.dragging)) {
        scheduleLayoutSave();
      }
    },
    [scheduleLayoutSave],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((current) => applyEdgeChanges(changes, current) as FlowEdge[]),
    [],
  );

  /* ------------------------------- interactions ----------------------------- */

  const createRelationship = useCallback(
    (sourceElementId: string, targetElementId: string) => {
      if (sourceElementId === targetElementId) return;
      const source = elementsById.get(sourceElementId)?.name ?? sourceElementId;
      const target = elementsById.get(targetElementId)?.name ?? targetElementId;
      applyOperations.mutate({
        label: `Connected ${source} → ${target}`,
        operations: [
          {
            op: "createRelationship",
            data: { sourceElementId, targetElementId, interactionStyle: "sync" },
          },
        ],
      });
    },
    [applyOperations, elementsById],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      createRelationship(connection.source, connection.target);
    },
    [createRelationship],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      const node = selectedNodes[0];
      const edge = selectedEdges[0];
      if (node) {
        select({
          type: "element",
          id: isBoundaryId(node.id) ? boundaryElementId(node.id) : node.id,
        });
      } else if (edge) {
        select({ type: "relationship", id: relationshipIdOf(edge) });
      }
    },
    [select],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      if (!connectFrom || isBoundaryId(node.id)) return;
      createRelationship(connectFrom, node.id);
      setConnectFrom(null);
    },
    [connectFrom, createRelationship, setConnectFrom],
  );

  const removeFromView = useCallback(
    (elementId: string) =>
      applyOperations.mutate({
        label: t("contextMenu.removeFromView"),
        operations: [
          { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "remove" },
        ],
      }),
    [applyOperations, t, view.id],
  );

  const hideInView = useCallback(
    (elementId: string) =>
      applyOperations.mutate({
        label: t("contextMenu.hideFromView"),
        operations: [{ op: "setLayout", viewId: view.id, entries: [{ elementId, hidden: true }] }],
      }),
    [applyOperations, t, view.id],
  );

  const deleteRelationships = useCallback(
    (relationshipIds: readonly string[]) => {
      const ids = [...new Set(relationshipIds.filter((id) => !id.startsWith("implied:")))];
      if (ids.length === 0) return;
      applyOperations.mutate({
        label: t("contextMenu.deleteRelationship"),
        operations: ids.map((relationshipId) => ({
          op: "deleteRelationship" as const,
          relationshipId,
        })),
      });
    },
    [applyOperations, t],
  );

  const deleteFromModel = useCallback(
    (elementId: string) => {
      const name = elementsById.get(elementId)?.name ?? elementId;
      applyOperations.mutate({
        label: `Deleted ${name}`,
        operations: [{ op: "deleteElement", elementId, cascade: true }],
      });
    },
    [applyOperations, elementsById],
  );

  const duplicateElement = useCallback(
    (elementId: string) => {
      const element = elementsById.get(elementId);
      if (!element) return;
      const placement = view.elements.find((entry) => entry.elementId === elementId);
      applyOperations.mutate({
        label: `Duplicated ${element.name}`,
        operations: [
          {
            op: "createElement",
            ref: "copy",
            data: {
              kind: element.kind,
              role: element.role,
              parentId: element.parentId,
              name: `${element.name} (copy)`,
              description: element.description,
              technology: element.technology,
              external: element.external,
              tags: element.tags,
              properties: element.properties,
            },
          },
          { op: "setViewElements", viewId: view.id, elementIds: ["@copy"], mode: "add" },
          {
            op: "setLayout",
            viewId: view.id,
            entries: [
              { elementId: "@copy", x: (placement?.x ?? 0) + 40, y: (placement?.y ?? 0) + 40 },
            ],
          },
        ],
      });
    },
    [applyOperations, elementsById, view.elements, view.id],
  );

  const onNodeContextMenu = useCallback<NodeMouseHandler>(
    (event, node) => {
      event.preventDefault();
      const elementId = isBoundaryId(node.id) ? boundaryElementId(node.id) : node.id;
      select({ type: "element", id: elementId });
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            label: t("contextMenu.edit"),
            onSelect: () => select({ type: "element", id: elementId }),
          },
          { label: t("contextMenu.duplicate"), onSelect: () => duplicateElement(elementId) },
          { label: t("contextMenu.connect"), onSelect: () => setConnectFrom(elementId) },
          {
            label: t("contextMenu.hideFromView"),
            onSelect: () => hideInView(elementId),
            separatorBefore: true,
          },
          { label: t("contextMenu.removeFromView"), onSelect: () => removeFromView(elementId) },
          {
            label: t("contextMenu.deleteFromModel"),
            onSelect: () => deleteFromModel(elementId),
            destructive: true,
            separatorBefore: true,
          },
        ],
      });
    },
    [deleteFromModel, duplicateElement, hideInView, removeFromView, select, setConnectFrom, t],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: FlowEdge) => {
      event.preventDefault();
      const relationshipId = relationshipIdOf(edge);
      select({ type: "relationship", id: relationshipId });
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            label: t("contextMenu.deleteRelationship"),
            destructive: true,
            onSelect: () => deleteRelationships([relationshipId]),
          },
        ],
      });
    },
    [deleteRelationships, select, t],
  );

  /* ------------------------------ drag and drop ----------------------------- */

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const elementId = event.dataTransfer.getData(DRAG_MIME);
      if (!elementId) return;
      if (view.elements.some((entry) => entry.elementId === elementId && !entry.hidden)) {
        toast.message(t("explorer.inView"));
        return;
      }
      const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      applyOperations.mutate({
        label: t("explorer.addToView"),
        operations: [
          { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "add" },
          {
            op: "setLayout",
            viewId: view.id,
            entries: [
              {
                elementId,
                x: Math.round(position.x - NODE_WIDTH / 2),
                y: Math.round(position.y - NODE_HEIGHT / 2),
                hidden: false,
              },
            ],
          },
        ],
      });
    },
    [applyOperations, flow, t, view.elements, view.id],
  );

  /* --------------------------------- render --------------------------------- */

  const allNodes = useMemo(() => {
    const sources = nodes
      .filter((node) => node.type === "element")
      .map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? NODE_HEIGHT,
      }));
    // A parent shown as a boundary has no entry in `nodes`, so mirror the
    // selection onto it here.
    const boundaries = computeBoundaries(sources, elementsById, view.settings.showBoundaries).map(
      (boundary) => ({
        ...boundary,
        selected: selection.type === "element" && selection.id === boundaryElementId(boundary.id),
      }),
    );
    return [...boundaries, ...nodes];
  }, [nodes, elementsById, view.settings.showBoundaries, selection]);

  return (
    <div
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
    >
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={() => {
          setMenu(null);
          setConnectFrom(null);
        }}
        onNodesDelete={(deleted) => {
          for (const node of deleted) {
            if (!isBoundaryId(node.id)) removeFromView(node.id);
          }
        }}
        onEdgesDelete={(deleted) => deleteRelationships(deleted.map(relationshipIdOf))}
        snapToGrid={view.settings.snapToGrid}
        snapGrid={[16, 16]}
        minZoom={0.15}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: false }}
        deleteKeyCode={["Delete", "Backspace"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--canvas-dot)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeStrokeWidth={2}
          maskColor="transparent"
        />
      </ReactFlow>

      {graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium">{t("canvas.empty")}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{t("canvas.emptyHint")}</p>
        </div>
      )}

      {graph.hiddenCount > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 rounded border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
          {t("canvas.hiddenElements", { count: graph.hiddenCount })}
        </div>
      )}

      {connectFrom && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
          {t("contextMenu.connect")}: {elementsById.get(connectFrom)?.name}
        </div>
      )}

      {menu && <NodeContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
