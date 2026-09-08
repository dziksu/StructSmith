import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BoundaryNodeData } from "./graph";

/**
 * A boundary is not a domain object — it is the visual footprint of a parent
 * element whose children are on the view (spec §34).
 */
function BoundaryNodeComponent({ data, selected }: NodeProps & { data: BoundaryNodeData }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "as-node h-full w-full rounded-lg border border-dashed",
        data.element.external
          ? "border-node-external-border/70 bg-ownership-external/[0.05]"
          : "border-node-internal-border/70 bg-ownership-internal/[0.05]",
      )}
      style={selected ? { borderColor: "var(--primary)" } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider">
        <span
          className={cn(
            "h-2 w-2 rounded-sm",
            data.element.external ? "bg-ownership-external" : "bg-ownership-internal",
          )}
        />
        <span className="text-foreground">{data.element.name}</span>
        <span
          className={cn(
            "font-medium",
            data.element.external ? "text-ownership-external" : "text-ownership-internal",
          )}
        >
          {data.element.external ? t("inspector.external") : t("inspector.internal")}
        </span>
      </div>
    </div>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
