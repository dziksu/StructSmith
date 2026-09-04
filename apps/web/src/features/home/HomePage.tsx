import type { WorkspaceMode } from "@structsmith/contracts";
import { WorkspaceDocumentSchema } from "@structsmith/contracts";
import { FileUp, FolderOpen, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiErrorHandler, useSettings, useWorkspaces } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { queryClient, queryKeys } from "@/lib/query";
import { formatDateTime } from "@/lib/utils";

const EXAMPLE_ID = "example-client-portal";

export function HomePage({ onOpenWorkspace }: { onOpenWorkspace: (workspaceId: string) => void }) {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const workspaces = useWorkspaces();
  const onError = useApiErrorHandler();
  const fileInput = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>("relaxed");

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  };

  const create = (): void => {
    if (!name.trim()) return;
    api
      .createWorkspace({ name: name.trim(), description: description.trim() || null, mode })
      .then((workspace) => {
        refresh();
        setCreateOpen(false);
        setName("");
        setDescription("");
        onOpenWorkspace(workspace.id);
      })
      .catch(onError);
  };

  const importFile = async (file: File): Promise<void> => {
    try {
      const document = WorkspaceDocumentSchema.parse(JSON.parse(await file.text()));
      const workspace = await api.importWorkspace(document);
      toast.success(t("home.imported"));
      refresh();
      onOpenWorkspace(workspace.id);
    } catch (error) {
      onError(error);
    }
  };

  const remove = (workspaceId: string, workspaceName: string): void => {
    if (!window.confirm(t("home.deleteHint", { name: workspaceName }))) return;
    api.deleteWorkspace(workspaceId).then(refresh).catch(onError);
  };

  const example = workspaces.data?.find((workspace) => workspace.id === EXAMPLE_ID);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <h1 className="text-xl font-semibold tracking-tight">
            {settings.data?.productName ?? "StructSmith"}
          </h1>
          <Badge variant="outline">{settings.data?.version ?? ""}</Badge>
        </div>
        <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">{t("home.subtitle")}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t("home.newWorkspace")}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <FileUp className="h-3.5 w-3.5" />
            {t("home.importWorkspace")}
          </Button>
          {example && (
            <Button variant="outline" onClick={() => onOpenWorkspace(example.id)}>
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.openExample")}
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <h2 className="mt-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("home.recentWorkspaces")}
        </h2>

        <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
          {workspaces.isLoading && (
            <p className="px-3 py-6 text-xs text-muted-foreground">{t("common.loading")}</p>
          )}
          {workspaces.data?.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground">{t("home.noWorkspaces")}</p>
          )}
          {workspaces.data?.map((workspace) => (
            <div
              key={workspace.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenWorkspace(workspace.id)}
              onKeyDown={(event) => event.key === "Enter" && onOpenWorkspace(workspace.id)}
              className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{workspace.name}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  {workspace.description || t("common.empty")}
                </div>
              </div>
              <div className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                <div>{formatDateTime(workspace.updatedAt, i18n.language)}</div>
                <div className="font-mono">
                  {t("home.revision", { revision: workspace.revision })}
                </div>
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(workspace.id, workspace.name);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.createTitle")}</DialogTitle>
            <DialogDescription>{t("home.createHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="workspace-name">{t("common.name")}</Label>
              <Input
                id="workspace-name"
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && create()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workspace-description">{t("common.description")}</Label>
              <Textarea
                id="workspace-description"
                value={description}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("home.modeLabel")}</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as WorkspaceMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relaxed">{t("home.modeRelaxed")}</SelectItem>
                  <SelectItem value="strict">{t("home.modeStrict")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
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
