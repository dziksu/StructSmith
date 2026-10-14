import type { XYPosition } from "@xyflow/react";
import type { FlowNode } from "./graph";

export interface BoundaryDrag {
  id: string;
  origin: XYPosition;
  members: ReadonlyMap<string, XYPosition>;
}

export function startBoundaryDrag(node: FlowNode, nodes: readonly FlowNode[]): BoundaryDrag | null {
  if (node.type !== "boundary") return null;
  const members = new Set(node.data.memberElementIds);
  return {
    id: node.id,
    origin: { ...node.position },
    members: new Map(
      nodes
        .filter(
          (member) =>
            member.type === "element" && members.has(member.id) && member.draggable !== false,
        )
        .map((member) => [member.id, { ...member.position }]),
    ),
  };
}

/** Use one delta for every member so grid snapping preserves the internal layout. */
export function boundaryDragPositions(
  drag: BoundaryDrag,
  position: XYPosition,
): Map<string, XYPosition> {
  const dx = position.x - drag.origin.x;
  const dy = position.y - drag.origin.y;
  return new Map(
    [...drag.members].map(([id, origin]) => [id, { x: origin.x + dx, y: origin.y + dy }]),
  );
}
