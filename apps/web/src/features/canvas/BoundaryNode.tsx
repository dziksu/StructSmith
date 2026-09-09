import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BoundaryNodeData } from "./graph";

/** A semantic boundary rendered from the live footprint of its visible members. */
function BoundaryNodeComponent({ data, selected }: NodeProps & { data: BoundaryNodeData }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "as-node h-full w-full rounded-lg border border-dashed",
        data.classification === "public"
          ? "border-node-external-border/70 bg-ownership-external/[0.05]"
          : data.classification === "private"
            ? "border-node-internal-border/80 bg-ownership-internal/[0.06]"
            : "border-border/80 bg-muted/[0.04]",
      )}
      style={selected ? { borderColor: "var(--primary)" } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider">
        <span
          className={cn(
            "h-2 w-2 rounded-sm",
            data.classification === "public" ? "bg-ownership-external" : "bg-ownership-internal",
          )}
        />
        <span className="text-foreground">{data.name}</span>
        <span
          className={cn(
            "font-medium",
            data.classification === "public"
              ? "text-ownership-external"
              : "text-ownership-internal",
          )}
        >
          {data.classification
            ? t(`boundaries.classification.${data.classification}`)
            : t(`boundaries.layer.${data.layer}`)}
        </span>
      </div>
    </div>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
