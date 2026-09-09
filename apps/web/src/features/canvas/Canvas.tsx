import type {
  ArchitectureBoundary,
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
  type OnNodeDrag,
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
import { useCopyAgentReference } from "../reference/useCopyAgentReference";
import { BoundaryNode } from "./BoundaryNode";
import { ElementNode } from "./ElementNode";
import {
  boundaryElementId,
  buildGraph,
  computeBoundaries,
  computeSemanticBoundaries,
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
  boundaries: readonly ArchitectureBoundary[];
  relationships: readonly ArchitectureRelationship[];
  records: readonly ArchitectureRecord[];
}

export function Canvas({
  workspaceId,
  view,
  elements,
  boundaries,
  relationships,
  records,
}: CanvasProps) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const onError = useApiErrorHandler();
  const applyOperations = useApplyOperations(workspaceId);
  const copyReference = useCopyAgentReference();
  const pushHistory = useHistoryStore((state) => state.push);

  const select = useEditorStore((state) => state.select);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const selection = useEditorStore((state) => state.selection);
  const connectFrom = useEditorStore((state) => state.connectFrom);
  const setConnectFrom = useEditorStore((state) => state.setConnectFrom);
  const focusRequest = useEditorStore((state) => state.focusRequest);
  const beginSave = useEditorStore((state) => state.beginSave);
  const endSave = useEditorStore((state) => state.endSave);

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
  const dragOrigins = useRef(new Map<string, { x: number; y: number }>());
  const layoutSaveQueue = useRef<Promise<void>>(Promise.resolve());

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

  useEffect(() => {
    if (selection.type !== "relationship") return;
    setNodes((current) =>
      current.map((node) => (node.selected ? { ...node, selected: false } : node)),
    );
    setEdges((current) =>
      current.map((edge) => {
        const shouldSelect = relationshipIdOf(edge) === selection.id;
        return edge.selected === shouldSelect ? edge : { ...edge, selected: shouldSelect };
      }),
    );
  }, [selection]);

  /* --------------------------- layout persistence --------------------------- */

  const persistLayout = useCallback(
    (
      entries: { elementId: string; x: number; y: number }[],
      previous: { elementId: string; x: number; y: number }[],
    ) => {
      if (entries.length === 0) return;
      beginSave();
      const request = layoutSaveQueue.current.then(() => api.saveLayout(view.id, { entries }));
      // Keep gestures ordered. A slower earlier response must never overwrite a
      // newer position when somebody drags the same card several times quickly.
      layoutSaveQueue.current = request.then(
        () => undefined,
        () => undefined,
      );
      void request
        .then(() => {
          pushHistory({
            kind: "layout",
            viewId: view.id,
            entries: previous,
            label: t("toast.layoutSaved"),
          });
          invalidateWorkspace(workspaceId);
        })
        .catch(onError)
        .finally(endSave);
    },
    [beginSave, endSave, onError, pushHistory, t, view.id, workspaceId],
  );

  const flushLayout = useCallback(() => {
    const pending = [...pendingLayout.current.entries()];
    pendingLayout.current.clear();
    const entries = pending.map(([elementId, position]) => ({
      elementId,
      x: Math.round(position.x),
      y: Math.round(position.y),
    }));
    if (entries.length === 0) return;

    const previous = entries.map(({ elementId }) => {
      const stored = view.elements.find((entry) => entry.elementId === elementId);
      return { elementId, x: stored?.x ?? 0, y: stored?.y ?? 0 };
    });
    persistLayout(entries, previous);
  }, [persistLayout, view.elements]);

  const flushLayoutRef = useRef(flushLayout);
  flushLayoutRef.current = flushLayout;

  // A view switch unmounts this canvas. Commit a pending keyboard move rather
  // than discarding it together with the debounce timer.
  useEffect(
    () => () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
      flushLayoutRef.current();
    },
    [],
  );

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
        if (
          change.type === "position" &&
          change.position &&
          !change.dragging &&
          !dragOrigins.current.has(change.id)
        ) {
          pendingLayout.current.set(change.id, change.position);
        }
      }
      if (
        relevant.some(
          (change) =>
            change.type === "position" && !change.dragging && !dragOrigins.current.has(change.id),
        )
      ) {
        scheduleLayoutSave();
      }
    },
    [scheduleLayoutSave],
  );

  const onNodeDragStart = useCallback<OnNodeDrag<FlowNode>>(
    (_event, node, draggedNodes) => {
      // Finish a preceding keyboard move before starting a separate gesture.
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
      flushLayout();
      dragOrigins.current.clear();
      for (const dragged of draggedNodes.length > 0 ? draggedNodes : [node]) {
        if (isBoundaryId(dragged.id)) continue;
        dragOrigins.current.set(dragged.id, {
          x: dragged.position.x,
          y: dragged.position.y,
        });
      }
    },
    [flushLayout],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    (_event, node, draggedNodes) => {
      const moved = (draggedNodes.length > 0 ? draggedNodes : [node]).filter(
        (dragged) => !isBoundaryId(dragged.id),
      );
      const changes = moved.flatMap((dragged) => {
        const before = dragOrigins.current.get(dragged.id);
        const after = {
          x: Math.round(dragged.position.x),
          y: Math.round(dragged.position.y),
        };
        if (!before || (Math.round(before.x) === after.x && Math.round(before.y) === after.y)) {
          return [];
        }
        return [{ elementId: dragged.id, before, after }];
      });
      dragOrigins.current.clear();
      persistLayout(
        changes.map(({ elementId, after }) => ({ elementId, ...after })),
        changes.map(({ elementId, before }) => ({ elementId, ...before })),
      );
    },
    [persistLayout],
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
        if (node.type === "boundary" && node.data?.boundaryId) {
          select({ type: "boundary", id: String(node.data.boundaryId) });
        } else {
          select({
            type: "element",
            id: isBoundaryId(node.id) ? boundaryElementId(node.id) : node.id,
          });
        }
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
      if (node.type === "boundary" && node.data?.boundaryId) {
        select({ type: "boundary", id: String(node.data.boundaryId) });
        return;
      }
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
          {
            label: t("reference.copy"),
            onSelect: () =>
              void copyReference({
                type: "element",
                workspaceId,
                targetId: elementId,
                label: elementsById.get(elementId)?.name,
                viewId: view.id,
              }),
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
    [
      copyReference,
      deleteFromModel,
      duplicateElement,
      elementsById,
      hideInView,
      removeFromView,
      select,
      setConnectFrom,
      t,
      view.id,
      workspaceId,
    ],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: FlowEdge) => {
      event.preventDefault();
      const relationshipId = relationshipIdOf(edge);
      const relationship = relationships.find((item) => item.id === relationshipId);
      select({ type: "relationship", id: relationshipId });
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            label: t("reference.copy"),
            onSelect: () =>
              void copyReference({
                type: "relationship",
                workspaceId,
                targetId: relationshipId,
                label: relationship
                  ? `${elementsById.get(relationship.sourceElementId)?.name ?? relationship.sourceElementId} → ${elementsById.get(relationship.targetElementId)?.name ?? relationship.targetElementId}`
                  : relationshipId,
                viewId: view.id,
              }),
          },
          {
            label: t("contextMenu.deleteRelationship"),
            destructive: true,
            separatorBefore: true,
            onSelect: () => deleteRelationships([relationshipId]),
          },
        ],
      });
    },
    [
      copyReference,
      deleteRelationships,
      elementsById,
      relationships,
      select,
      t,
      view.id,
      workspaceId,
    ],
  );

  /* ------------------------------ drag and drop ----------------------------- */

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const elementId = event.dataTransfer.getData(DRAG_MIME);
      if (!elementId) return;
      const targetNode = (event.target as Element | null)?.closest<HTMLElement>(
        ".react-flow__node-boundary",
      );
      const candidateBoundaryId = targetNode?.dataset.id?.startsWith("boundary:")
        ? boundaryElementId(targetNode.dataset.id)
        : null;
      const targetBoundaryId = boundaries.some((boundary) => boundary.id === candidateBoundaryId)
        ? candidateBoundaryId
        : null;
      const alreadyVisible = view.elements.some(
        (entry) => entry.elementId === elementId && !entry.hidden,
      );
      if (alreadyVisible && !targetBoundaryId) {
        toast.message(t("explorer.inView"));
        return;
      }
      const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      applyOperations.mutate({
        label: targetBoundaryId ? t("boundaries.membershipChanged") : t("explorer.addToView"),
        operations: [
          { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "add" },
          ...(!alreadyVisible
            ? [
                {
                  op: "setLayout" as const,
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
              ]
            : []),
          ...(targetBoundaryId
            ? [
                {
                  op: "setBoundaryMembers" as const,
                  boundaryId: targetBoundaryId,
                  elementIds: [elementId],
                  mode: "add" as const,
                },
              ]
            : []),
        ],
      });
    },
    [applyOperations, boundaries, flow, t, view.elements, view.id],
  );

  /* --------------------------------- render --------------------------------- */

  const allNodes = useMemo(() => {
    const sources = nodes
      .filter((node) => node.type === "element")
      .map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width ?? node.width ?? NODE_WIDTH,
        height: node.measured?.height ?? node.height ?? NODE_HEIGHT,
      }));
    // A parent shown as a boundary has no entry in `nodes`, so mirror the
    // selection onto it here.
    const legacyBoundaries = computeBoundaries(
      sources,
      elementsById,
      view.settings.showBoundaries,
    ).map((boundary) => ({
      ...boundary,
      selected: selection.type === "element" && selection.id === boundaryElementId(boundary.id),
    }));
    const semanticBoundaries = computeSemanticBoundaries(
      sources,
      boundaries,
      view.settings.boundaryLayer,
      view.settings.showBoundaries,
    ).map((boundary) => ({
      ...boundary,
      selected: selection.type === "boundary" && selection.id === boundary.data.boundaryId,
    }));
    return [...semanticBoundaries, ...legacyBoundaries, ...nodes];
  }, [
    nodes,
    elementsById,
    boundaries,
    view.settings.showBoundaries,
    view.settings.boundaryLayer,
    selection,
  ]);

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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={() => {
          setMenu(null);
          clearSelection();
          setNodes((current) =>
            current.map((node) => (node.selected ? { ...node, selected: false } : node)),
          );
          setEdges((current) =>
            current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
          );
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

      {graph.nodes.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm backdrop-blur-sm">
          <span className="text-muted-foreground">{t("canvas.legend")}</span>
          <span className="flex items-center gap-1 text-ownership-internal">
            <span className="h-2 w-2 rounded-sm bg-ownership-internal" />
            {t("inspector.internal")}
          </span>
          <span className="flex items-center gap-1 text-ownership-external">
            <span className="h-2 w-2 rounded-sm border border-dashed border-ownership-external bg-ownership-external/15" />
            {t("inspector.external")}
          </span>
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
