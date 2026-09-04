import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { BoundaryNodeData } from "./graph";

/**
 * A boundary is not a domain object — it is the visual footprint of a parent
 * element whose children are on the view (spec §34).
 */
function BoundaryNodeComponent({ data, selected }: NodeProps & { data: BoundaryNodeData }) {
  return (
    <div
      className="as-node h-full w-full rounded-lg border border-dashed border-boundary/50 bg-boundary/[0.04]"
      style={selected ? { borderColor: "var(--primary)" } : undefined}
    >
      <div className="px-3 py-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {data.element.name}
      </div>
    </div>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
