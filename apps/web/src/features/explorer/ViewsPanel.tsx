import type { ArchitectureElement, ArchitectureView, ViewKind } from "@structsmith/contracts";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tooltip } from "@/components/ui/tooltip";
import { useApplyOperations } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

const VIEW_KINDS: ViewKind[] = [
  "systemContext",
  "container",
  "component",
  "landscape",
  "deployment",
  "custom",
];

interface ViewsPanelProps {
  workspaceId: string;
  views: readonly ArchitectureView[];
  elements: readonly ArchitectureElement[];
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
}

export function ViewsPanel({
  workspaceId,
  views,
  elements,
  activeViewId,
  onSelectView,
}: ViewsPanelProps) {
  const { t } = useTranslation();
  const applyOperations = useApplyOperations(workspaceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ViewKind>("container");
  const [scope, setScope] = useState<string>("none");
  const [seed, setSeed] = useState<"empty" | "all">("empty");

  const create = (): void => {
    if (!name.trim()) return;
    applyOperations.mutate(
      {
        label: t("views.create"),
        operations: [
          {
            op: "createView",
            ref: "view",
            data: {
              name: name.trim(),
              kind,
              scopeElementId: scope === "none" ? null : scope,
              elementIds: seed === "all" ? elements.map((element) => element.id) : [],
            },
          },
          { op: "autoLayoutView", viewId: "@view", direction: "LR" },
        ],
      },
      {
        onSuccess: (result) => {
          const created = result.appliedOperations.find((operation) => operation.ref === "view");
          if (created?.id) onSelectView(created.id);
          setOpen(false);
          setName("");
        },
      },
    );
  };

  const remove = (viewId: string): void =>
    applyOperations.mutate({
      label: t("views.deleteTitle"),
      operations: [{ op: "deleteView", viewId }],
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("explorer.views")}
        </span>
        <Tooltip label={t("views.create")}>
          <Button size="iconSm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {views.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t("explorer.emptyViews")}</p>
          )}
          {views.map((view) => (
            <div
              key={view.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectView(view.id)}
              onKeyDown={(event) => event.key === "Enter" && onSelectView(view.id)}
              className={cn(
                "group flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[12.5px] transition-colors hover:bg-accent",
                view.id === activeViewId && "bg-accent",
              )}
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{view.name}</div>
                <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t(`viewKinds.${view.kind}`)}
                </div>
              </div>
              <button
                type="button"
                className="hidden rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(view.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("views.create")}</DialogTitle>
            <DialogDescription>{t("inspector.hint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="view-name">{t("views.name")}</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>{t("views.kind")}</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as ViewKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`viewKinds.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t("views.scope")}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {elements
                    .filter((element) => element.kind === "softwareSystem" || element.kind === "container")
                    .map((element) => (
                      <SelectItem key={element.id} value={element.id}>
                        {element.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t("views.seed")}</Label>
              <Select value={seed} onValueChange={(value) => setSeed(value as "empty" | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty">{t("views.seedEmpty")}</SelectItem>
                  <SelectItem value="all">{t("views.seedAll")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
