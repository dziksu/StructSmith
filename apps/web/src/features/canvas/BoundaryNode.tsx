import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { BoundaryNodeData } from "./graph";

/** A semantic boundary rendered from the live footprint of its visible members. */
function BoundaryNodeComponent({ data, selected }: NodeProps & { data: BoundaryNodeData }) {
  const { t } = useTranslation();
  const accent =
    data.classification === "public"
      ? "var(--ownership-external)"
      : data.classification === "private"
        ? "var(--ownership-internal)"
        : "var(--boundary)";

  return (
    <div
      className={cn(
        "as-node h-full w-full overflow-hidden rounded-lg shadow-lg",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
      )}
      style={{
        outline: selected ? "3px solid var(--primary)" : undefined,
        outlineOffset: selected ? 2 : undefined,
      }}
    >
      <div
        className="flex min-h-9 items-center gap-2 border-b px-3 py-2 text-xs font-bold uppercase tracking-wider backdrop-blur-sm"
        style={{
          borderColor: `color-mix(in oklch, ${accent} 45%, var(--canvas))`,
          backgroundColor: `color-mix(in oklch, ${accent} 34%, var(--canvas))`,
        }}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-sm",
            data.classification === "public" ? "bg-ownership-external" : "bg-ownership-internal",
          )}
        />
        <span className="text-foreground drop-shadow-sm">{data.name}</span>
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
            : data.kind
              ? t(`kinds.${data.kind}`)
              : t(`boundaries.layer.${data.layer}`)}
        </span>
      </div>
    </div>
  );
}

export const BoundaryNode = memo(BoundaryNodeComponent);
