import type { ValidationIssue } from "@structsmith/contracts";
import { AlertCircle, History, Info, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActivity, useApiErrorHandler, useSnapshots, useValidation } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { invalidateWorkspace } from "@/lib/query";
import { formatDateTime, formatTime } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";

const issueIcon = (level: ValidationIssue["level"]) => {
  if (level === "error") return AlertCircle;
  if (level === "warning") return TriangleAlert;
  return Info;
};

const issueColor = (level: ValidationIssue["level"]): string => {
  if (level === "error") return "text-destructive";
  if (level === "warning") return "text-warning";
  return "text-muted-foreground";
};

export function BottomPanel({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const panel = useEditorStore((state) => state.bottomPanel);
  const setPanel = useEditorStore((state) => state.setBottomPanel);
  const select = useEditorStore((state) => state.select);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const onError = useApiErrorHandler();

  const validation = useValidation(workspaceId);
  const activity = useActivity(workspaceId);
  const snapshots = useSnapshots(workspaceId);

  if (!panel) return null;

  const title =
    panel === "issues" ? t("issues.title") : panel === "activity" ? t("activity.title") : t("snapshots.title");

  const restore = (snapshotId: string): void => {
    api
      .restoreSnapshot(snapshotId)
      .then(() => {
        toast.success(t("snapshots.restored"));
        invalidateWorkspace(workspaceId);
      })
      .catch(onError);
  };

  return (
    <div className="flex h-56 flex-col border-t border-border bg-card">
      <div className="flex h-8 items-center justify-between border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-1">
          {panel === "snapshots" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                api
                  .createSnapshot(workspaceId, t("snapshots.defaultLabel"))
                  .then(() => invalidateWorkspace(workspaceId))
                  .catch(onError)
              }
            >
              <History className="h-3 w-3" />
              {t("snapshots.create")}
            </Button>
          )}
          <Button size="iconSm" variant="ghost" onClick={() => setPanel(panel)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {panel === "issues" && (
            <div className="space-y-0.5">
              {(validation.data?.issues.length ?? 0) === 0 && (
                <p className="px-1 py-3 text-xs text-muted-foreground">{t("issues.empty")}</p>
              )}
              {validation.data?.issues.map((issue, index) => {
                const Icon = issueIcon(issue.level);
                return (
                  <button
                    key={`${issue.code}-${issue.elementId ?? issue.relationshipId ?? index}`}
                    type="button"
                    className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-accent"
                    onClick={() => {
                      if (issue.elementId) {
                        select({ type: "element", id: issue.elementId });
                        requestFocus(issue.elementId);
                      } else if (issue.relationshipId) {
                        select({ type: "relationship", id: issue.relationshipId });
                      }
                    }}
                  >
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${issueColor(issue.level)}`} />
                    <span className="flex-1 text-[12.5px] leading-snug">{issue.message}</span>
                    <Badge variant="outline">{issue.code}</Badge>
                  </button>
                );
              })}
            </div>
          )}

          {panel === "activity" && (
            <div className="space-y-0.5">
              {(activity.data?.length ?? 0) === 0 && (
                <p className="px-1 py-3 text-xs text-muted-foreground">{t("activity.empty")}</p>
              )}
              {activity.data?.map((entry) => (
                <div key={entry.id} className="flex items-baseline gap-2 px-1.5 py-1 text-[12.5px]">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatTime(entry.createdAt, i18n.language)}
                  </span>
                  <Badge variant={entry.source === "mcp" ? "primary" : "outline"}>
                    {t(`snapshots.sources.${entry.source}`)}
                  </Badge>
                  <span className="flex-1">{entry.message}</span>
                </div>
              ))}
            </div>
          )}

          {panel === "snapshots" && (
            <div className="space-y-0.5">
              {(snapshots.data?.length ?? 0) === 0 && (
                <p className="px-1 py-3 text-xs text-muted-foreground">{t("snapshots.empty")}</p>
              )}
              {snapshots.data?.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-accent"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDateTime(snapshot.createdAt, i18n.language)}
                  </span>
                  <Badge variant={snapshot.source === "mcp" ? "primary" : "outline"}>
                    {t(`snapshots.sources.${snapshot.source}`)}
                  </Badge>
                  <span className="flex-1 truncate">{snapshot.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    r{snapshot.revision}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => restore(snapshot.id)}>
                    <RotateCcw className="h-3 w-3" />
                    {t("snapshots.restore")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
