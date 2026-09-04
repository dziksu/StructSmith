import type { ValidationResult } from "@structsmith/contracts";
import { Activity, AlertCircle, History, Loader2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";

interface StatusBarProps {
  revision: number;
  elementCount: number;
  relationshipCount: number;
  validation?: ValidationResult;
  mcpReady: boolean;
  mcpReadOnly: boolean;
}

export function StatusBar({
  revision,
  elementCount,
  relationshipCount,
  validation,
  mcpReady,
  mcpReadOnly,
}: StatusBarProps) {
  const { t } = useTranslation();
  const setPanel = useEditorStore((state) => state.setBottomPanel);
  const panel = useEditorStore((state) => state.bottomPanel);
  const pendingSave = useEditorStore((state) => state.pendingSave);

  const errors = validation?.issues.filter((issue) => issue.level === "error").length ?? 0;
  const warnings = validation?.issues.filter((issue) => issue.level === "warning").length ?? 0;

  const Item = ({
    active,
    onClick,
    children,
  }: {
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
        onClick && "hover:bg-accent",
        active && "bg-accent",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-6 items-center gap-1 border-t border-border bg-card px-2 text-[11px] text-muted-foreground">
      <Item onClick={() => setPanel("issues")} active={panel === "issues"}>
        <AlertCircle className={cn("h-3 w-3", errors > 0 && "text-destructive")} />
        {errors}
        <TriangleAlert className={cn("ml-1 h-3 w-3", warnings > 0 && "text-warning")} />
        {warnings}
      </Item>

      <Item onClick={() => setPanel("activity")} active={panel === "activity"}>
        <Activity className="h-3 w-3" />
        {t("activity.title")}
      </Item>

      <Item onClick={() => setPanel("snapshots")} active={panel === "snapshots"}>
        <History className="h-3 w-3" />
        {t("snapshots.title")}
      </Item>

      <span className="flex-1" />

      {pendingSave > 0 && (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("status.saving")}
        </span>
      )}

      <span>{t("status.elements", { count: elementCount })}</span>
      <span>·</span>
      <span>{t("status.relationships", { count: relationshipCount })}</span>
      <span>·</span>
      <span className="font-mono">{t("status.revision", { revision })}</span>
      <span>·</span>
      <span className={cn("flex items-center gap-1", mcpReady && "text-success")}>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            mcpReady ? "bg-success" : "bg-muted-foreground",
          )}
        />
        MCP{mcpReadOnly ? " (read-only)" : ""}
      </span>
    </div>
  );
}
