import { Handle, type NodeProps, Position } from "@xyflow/react";
import { AlertTriangle, Lock } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { iconFor } from "../icons";
import type { ElementNodeData } from "./graph";

/** Custom node (spec §33) — icon, name, technology and a small kind/role badge. */
function ElementNodeComponent({ data, selected }: NodeProps & { data: ElementNodeData }) {
  const { t } = useTranslation();
  const { element, severity, locked, showFullTitles, showDescriptions, minimumHeight } = data;
  const Icon = iconFor(element.kind, element.role);

  const badge = [t(`kinds.${element.kind}`), element.role ? t(`roles.${element.role}`) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{ minHeight: minimumHeight }}
      className={cn(
        "as-node group relative flex h-full w-full overflow-hidden rounded-md border shadow-sm transition-[border-color,background-color,box-shadow]",
        element.external
          ? "border-dashed border-node-external-border bg-node-external shadow-ownership-external/5"
          : "border-node-internal-border bg-node-internal shadow-ownership-internal/5",
        selected && "shadow-md",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-1 shrink-0",
          element.external ? "bg-ownership-external" : "bg-ownership-internal",
        )}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="target" position={Position.Top} id="t" />

      <div className="flex min-w-0 flex-1 flex-col justify-between px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded",
              element.external
                ? "bg-ownership-external/15 text-ownership-external"
                : "bg-ownership-internal/15 text-ownership-internal",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div
              title={element.name}
              className={cn(
                "text-[13px] font-semibold leading-4",
                showFullTitles ? "whitespace-normal [overflow-wrap:anywhere]" : "truncate",
              )}
            >
              {element.name}
            </div>
            {element.technology && (
              <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                {element.technology}
              </div>
            )}
          </div>
          {severity && (
            <AlertTriangle
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                severity === "critical" ? "text-destructive" : "text-warning",
              )}
            />
          )}
          {locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>

        {showDescriptions && element.description?.trim() && (
          <p className="mt-2 whitespace-pre-line text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">
            {element.description.trim()}
          </p>
        )}

        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              element.external
                ? "border-ownership-external/45 bg-ownership-external/10 text-ownership-external"
                : "border-ownership-internal/45 bg-ownership-internal/10 text-ownership-internal",
            )}
          >
            {element.external ? t("inspector.external") : t("inspector.internal")}
          </span>
          <span className="truncate text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {badge}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} id="b" />
    </div>
  );
}

export const ElementNode = memo(ElementNodeComponent);
