import type { ArchitectureRelationship, ViewRelationship } from "@structsmith/contracts";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
} from "@xyflow/react";
import { memo, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useApplyOperations } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import type { RelationshipEdgeData } from "./graph";
import { pathThroughControlPoints, pointOnRelationshipPath } from "./relationshipGeometry";

export type RelationshipFocus = "normal" | "connected" | "dimmed";

export function relationshipFocus(
  activeElementId: string | null,
  sourceElementId: string,
  targetElementId: string,
): RelationshipFocus {
  if (!activeElementId) return "normal";
  return activeElementId === sourceElementId || activeElementId === targetElementId
    ? "connected"
    : "dimmed";
}

export function relationshipLabelBackground(focus: RelationshipFocus): string {
  return focus === "connected"
    ? "color-mix(in oklch, var(--primary) 12%, var(--card))"
    : "var(--card)";
}

export function relationshipLineStyle(
  interactionStyle: ArchitectureRelationship["interactionStyle"],
  override: ViewRelationship["lineStyle"],
): "solid" | "dashed" | "dotted" {
  return (
    override ?? (["async", "event", "dependency"].includes(interactionStyle) ? "dashed" : "solid")
  );
}

/** Appearance and placement belong to the view; text remains semantic. */
function RelationshipEdgeComponent({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  target,
  data,
}: EdgeProps & { data?: RelationshipEdgeData }) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const applyOperations = useApplyOperations(data?.workspaceId ?? "");
  const select = useEditorStore((state) => state.select);
  const markerId = useId().replace(/:/g, "");
  const placement = data?.placement;
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ start: { x: number; y: number }; offset: { x: number; y: number } } | null>(
    null,
  );
  useEffect(() => setDragOffset(placement?.labelOffset ?? null), [placement?.labelOffset]);
  const activeElementId = useEditorStore((state) =>
    state.selection.type === "element" ? state.selection.id : null,
  );
  const focus = relationshipFocus(activeElementId, source, target);
  const pathOptions = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };

  const [automaticPath] =
    data?.routing === "straight"
      ? getStraightPath(pathOptions)
      : data?.routing === "curved"
        ? getBezierPath(pathOptions)
        : getSmoothStepPath({ ...pathOptions, borderRadius: 8, offset: 24 });
  const path = placement?.controlPoints.length
    ? pathThroughControlPoints(
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
        sourcePosition,
        targetPosition,
        placement.controlPoints,
        data?.routing === "orthogonal",
      )
    : automaticPath;
  const anchor = pointOnRelationshipPath(path, placement?.labelPosition ?? 0.5);
  const offset = dragOffset ?? placement?.labelOffset ?? { x: 0, y: 0 };
  const labelX = anchor.x + offset.x;
  const labelY = anchor.y + offset.y;

  const relationship = data?.relationship;
  const lineStyle = relationshipLineStyle(
    relationship?.interactionStyle ?? "sync",
    placement?.lineStyle,
  );
  const color =
    placement?.color ?? (selected || focus === "connected" ? "var(--primary)" : "var(--edge)");
  const strokeWidth = placement?.strokeWidth ?? (data?.implied ? 1.1 : 1.4);
  const startArrow = placement?.startArrow ?? "none";
  const endArrow = placement?.endArrow ?? "closed";

  const saveOffset = (next: { x: number; y: number }) => {
    if (!data?.editable || !relationship) return;
    setDragOffset(next);
    applyOperations.mutate(
      {
        label: t("relationshipPresentation.updated"),
        operations: [
          {
            op: "setViewRelationships",
            viewId: data.viewId,
            relationships: [{ relationshipId: relationship.id, labelOffset: next }],
          },
        ],
      },
      { onError: () => setDragOffset(null) },
    );
  };

  const label =
    data?.implied && (data?.count ?? 0) > 1 ? `${data.label} (${data.count})` : (data?.label ?? "");

  return (
    <>
      <defs>
        {(
          [
            ["start", startArrow],
            ["end", endArrow],
          ] as const
        )
          .filter(([, kind]) => kind !== "none")
          .map(([end, kind]) => (
            <marker
              key={end}
              id={`${markerId}-${end}`}
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth="16"
              markerHeight="16"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path
                d={kind === "closed" ? "M1,1 L11,6 L1,11 Z" : "M1,1 L11,6 L1,11"}
                fill={kind === "closed" ? color : "none"}
                stroke={color}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </marker>
          ))}
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerStart={startArrow === "none" ? undefined : `url(#${markerId}-start)`}
        markerEnd={endArrow === "none" ? undefined : `url(#${markerId}-end)`}
        style={{
          strokeWidth: selected || focus === "connected" ? Math.max(2.4, strokeWidth) : strokeWidth,
          strokeDasharray:
            lineStyle === "dashed" ? "5 4" : lineStyle === "dotted" ? "1 4" : undefined,
          stroke: color,
          opacity: focus === "dimmed" ? 0.7 : 1,
          filter: focus === "connected" ? "drop-shadow(0 0 3px var(--primary))" : undefined,
          transition: "stroke 150ms, stroke-width 150ms, opacity 150ms, filter 150ms",
        }}
      />
      {label && (data?.showLabel !== false || selected) && (
        <EdgeLabelRenderer>
          <Button
            variant="outline"
            aria-label={t("relationshipPresentation.moveLabel", { label })}
            title={t("relationshipPresentation.labelHelp")}
            disabled={!data?.editable}
            onClick={(event) => {
              event.stopPropagation();
              if (relationship) select({ type: "relationship", id: relationship.id });
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !data?.editable) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                start: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                offset,
              };
              if (relationship) select({ type: "relationship", id: relationship.id });
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              setDragOffset({
                x: drag.current.offset.x + point.x - drag.current.start.x,
                y: drag.current.offset.y + point.y - drag.current.start.y,
              });
            }}
            onPointerUp={(event) => {
              const origin = drag.current;
              drag.current = null;
              if (!origin) return;
              const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              if (Math.hypot(point.x - origin.start.x, point.y - origin.start.y) > 1)
                saveOffset({
                  x: origin.offset.x + point.x - origin.start.x,
                  y: origin.offset.y + point.y - origin.start.y,
                });
              else setDragOffset(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragOffset(null);
            }}
            onKeyDown={(event) => {
              const delta = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              }[event.key];
              if (!delta) return;
              event.preventDefault();
              event.stopPropagation();
              if (relationship) select({ type: "relationship", id: relationship.id });
              const step = event.shiftKey ? 10 : 1;
              saveOffset({
                x: offset.x + (delta[0] ?? 0) * step,
                y: offset.y + (delta[1] ?? 0) * step,
              });
            }}
            className={cn(
              "nodrag nopan pointer-events-auto absolute h-auto max-w-[170px] cursor-grab touch-none whitespace-normal rounded border px-1.5 py-0.5 text-center text-[10px] font-medium leading-[1.3] shadow-sm active:cursor-grabbing",
              focus === "connected"
                ? "border-primary/70 text-foreground"
                : "border-border text-foreground",
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: relationshipLabelBackground(focus),
              opacity: focus === "dimmed" ? 0.75 : 1,
              // Wrap to at most three lines — the layout reserves exactly this box.
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {label}
          </Button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
