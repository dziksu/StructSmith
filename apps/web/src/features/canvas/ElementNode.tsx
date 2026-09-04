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
  const { element, severity, locked } = data;
  const Icon = iconFor(element.kind, element.role);

  const badge = [t(`kinds.${element.kind}`), element.role ? t(`roles.${element.role}`) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "as-node group flex h-full w-full flex-col justify-between rounded-md border px-3 py-2.5 shadow-sm transition-colors",
        element.external
          ? "border-dashed border-node-border bg-node-external"
          : "border-node-border bg-node",
        selected && "border-primary",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="target" position={Position.Top} id="t" />

      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight">{element.name}</div>
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

      <div className="mt-2 flex items-center gap-1.5">
        <span className="truncate text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {element.external ? `${t("inspector.external")} · ${badge}` : badge}
        </span>
      </div>

      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} id="b" />
    </div>
  );
}

export const ElementNode = memo(ElementNodeComponent);
