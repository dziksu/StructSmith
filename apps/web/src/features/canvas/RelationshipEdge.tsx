import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/react";
import { memo } from "react";
import type { RelationshipEdgeData } from "./graph";

/**
 * Interaction style drives the line style; colour is purely presentation and
 * never stored on the model (spec §12).
 */
function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps & { data?: RelationshipEdgeData }) {
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
          strokeWidth: selected ? 2 : data?.implied ? 1.1 : 1.4,
          strokeDasharray: dashed ? "5 4" : undefined,
          stroke: selected ? "var(--primary)" : "var(--edge)",
        }}
      />
      {label && (data?.showLabel !== false || selected) && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute max-w-[170px] rounded border border-border bg-card/95 px-1.5 py-0.5 text-center text-[10px] font-medium leading-[1.3] text-foreground shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
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
