import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import type { RelationshipEdgeData } from "./graph";

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

/**
 * Interaction style drives the line style; colour is purely presentation and
 * never stored on the model (spec §12).
 */
function RelationshipEdgeComponent({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  target,
  data,
}: EdgeProps & { data?: RelationshipEdgeData }) {
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

  const [path, labelX, labelY] =
    data?.routing === "straight"
      ? getStraightPath(pathOptions)
      : data?.routing === "curved"
        ? getBezierPath(pathOptions)
        : getSmoothStepPath({ ...pathOptions, borderRadius: 8, offset: 24 });

  const relationship = data?.relationship;
  const dashed =
    relationship?.interactionStyle === "async" ||
    relationship?.interactionStyle === "event" ||
    relationship?.interactionStyle === "dependency";

  const label =
    data?.implied && (data?.count ?? 0) > 1 ? `${data.label} (${data.count})` : (data?.label ?? "");

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2 : focus === "connected" ? 2.4 : data?.implied ? 1.1 : 1.4,
          strokeDasharray: dashed ? "5 4" : undefined,
          stroke: selected || focus === "connected" ? "var(--primary)" : "var(--edge)",
          opacity: focus === "dimmed" ? 0.7 : 1,
          filter: focus === "connected" ? "drop-shadow(0 0 3px var(--primary))" : undefined,
          transition: "stroke 150ms, stroke-width 150ms, opacity 150ms, filter 150ms",
        }}
      />
      {label && (data?.showLabel !== false || selected) && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              "pointer-events-none absolute max-w-[170px] rounded border px-1.5 py-0.5 text-center text-[10px] font-medium leading-[1.3] shadow-sm transition-[border-color,background-color,opacity] duration-150",
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
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
