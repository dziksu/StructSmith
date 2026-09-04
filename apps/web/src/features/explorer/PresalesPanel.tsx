import type {
  ArchitectureElement,
  ArchitectureRecord,
  RecordKind,
  RecordStatus,
  Severity,
} from "@structsmith/contracts";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { useApplyOperations } from "@/hooks/useApi";
import { useEditorStore } from "@/store/editor";

const KINDS: RecordKind[] = ["assumption", "risk", "unknown", "requirement", "decision", "note"];
const STATUSES: RecordStatus[] = ["open", "confirmed", "resolved", "rejected"];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

const severityVariant = (severity: Severity | null) => {
  if (severity === "critical" || severity === "high") return "destructive" as const;
  if (severity === "medium") return "warning" as const;
  return "outline" as const;
};

interface Draft {
  id?: string;
  kind: RecordKind;
  title: string;
  contentMd: string;
  status: RecordStatus;
  severity: Severity | "none";
  linkedElementIds: string[];
}

const emptyDraft: Draft = {
  kind: "assumption",
  title: "",
  contentMd: "",
  status: "open",
  severity: "none",
  linkedElementIds: [],
};

export function PresalesPanel({
  workspaceId,
  records,
  elements,
}: {
  workspaceId: string;
  records: readonly ArchitectureRecord[];
  elements: readonly ArchitectureElement[];
}) {
  const { t } = useTranslation();
  const applyOperations = useApplyOperations(workspaceId);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const select = useEditorStore((state) => state.select);
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = (): void => {
    if (!draft?.title.trim()) return;
    const data = {
      kind: draft.kind,
      title: draft.title.trim(),
      contentMd: draft.contentMd.trim() || null,
      status: draft.status,
      severity: draft.severity === "none" ? null : draft.severity,
      linkedElementIds: draft.linkedElementIds,
    };
    applyOperations.mutate(
      {
        label: draft.id ? `Updated record ${data.title}` : `Added ${draft.kind}: ${data.title}`,
        operations: draft.id
          ? [{ op: "updateRecord", recordId: draft.id, data }]
          : [{ op: "createRecord", data }],
      },
      { onSuccess: () => setDraft(null) },
    );
  };

  const remove = (recordId: string): void =>
    applyOperations.mutate({
      label: t("common.delete"),
      operations: [{ op: "deleteRecord", recordId }],
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("presales.title")}
        </span>
        <Tooltip label={t("presales.newRecord")}>
          <Button size="iconSm" variant="ghost" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-1.5">
          {records.length === 0 && (
            <p className="px-1 py-4 text-xs text-muted-foreground">{t("presales.empty")}</p>
          )}
          {records.map((record) => (
            <div
              key={record.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                setDraft({
                  id: record.id,
                  kind: record.kind,
                  title: record.title,
                  contentMd: record.contentMd ?? "",
                  status: record.status,
                  severity: record.severity ?? "none",
                  linkedElementIds: record.linkedElementIds,
                })
              }
              onKeyDown={(event) =>
                event.key === "Enter" && select({ type: "record", id: record.id })
              }
              className="group cursor-pointer rounded border border-border/60 bg-card px-2 py-1.5 transition-colors hover:border-border hover:bg-accent/50"
            >
              <div className="flex items-center gap-1.5">
                <Badge variant="outline">{t(`presales.kinds.${record.kind}`)}</Badge>
                {record.severity && (
                  <Badge variant={severityVariant(record.severity)}>
                    {t(`presales.severities.${record.severity}`)}
                  </Badge>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  className="hidden rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                  onClick={(event) => {
                    event.stopPropagation();
                    remove(record.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 text-[12.5px] leading-snug">{record.title}</div>
              {record.linkedElementIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {record.linkedElementIds.map((elementId) => {
                    const element = elements.find((item) => item.id === elementId);
                    if (!element) return null;
                    return (
                      <button
                        key={elementId}
                        type="button"
                        className="rounded bg-secondary px-1 py-0.5 text-[10px] text-secondary-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          select({ type: "element", id: elementId });
                          requestFocus(elementId);
                        }}
                      >
                        {element.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("common.edit") : t("presales.newRecord")}</DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>{t("presales.kind")}</Label>
                  <Select
                    value={draft.kind}
                    onValueChange={(value) => setDraft({ ...draft, kind: value as RecordKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t(`presales.kinds.${kind}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("presales.status")}</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(value) => setDraft({ ...draft, status: value as RecordStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`presales.statuses.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("presales.severity")}</Label>
                  <Select
                    value={draft.severity}
                    onValueChange={(value) =>
                      setDraft({ ...draft, severity: value as Severity | "none" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common.none")}</SelectItem>
                      {SEVERITIES.map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {t(`presales.severities.${severity}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t("presales.titleField")}</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <Label>{t("presales.content")}</Label>
                <Textarea
                  value={draft.contentMd}
                  rows={5}
                  onChange={(event) => setDraft({ ...draft, contentMd: event.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label>{t("presales.linkedElements")}</Label>
                <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded border border-border p-1.5">
                  {elements.map((element) => {
                    const linked = draft.linkedElementIds.includes(element.id);
                    return (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            linkedElementIds: linked
                              ? draft.linkedElementIds.filter((id) => id !== element.id)
                              : [...draft.linkedElementIds, element.id],
                          })
                        }
                        className={
                          linked
                            ? "rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground"
                            : "rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                        }
                      >
                        {element.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={!draft?.title.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
