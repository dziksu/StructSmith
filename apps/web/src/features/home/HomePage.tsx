import type { Workspace, WorkspaceMode } from "@structsmith/contracts";
import { PRODUCT } from "@structsmith/contracts";
import {
  ArrowRight,
  Braces,
  Copy,
  FileUp,
  FolderOpen,
  Languages,
  Laptop,
  Layers3,
  Moon,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  Sun,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useApiErrorHandler, useMcpInfo, useSettings, useWorkspaces } from "@/hooks/useApi";
import { supportedLanguages } from "@/i18n";
import { api } from "@/lib/api";
import { queryClient, queryKeys } from "@/lib/query";
import { type Theme, useTheme } from "@/lib/theme";
import { formatDateTime } from "@/lib/utils";
import { useCopyAgentReference } from "../reference/useCopyAgentReference";
import { ImportWorkspaceDialog } from "./ImportWorkspaceDialog";

const EXAMPLE_ID = "example-client-portal";

interface HomePageProps {
  onOpenWorkspace: (workspaceId: string) => void;
  onOpenMcp: () => void;
}

const themes: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Laptop },
];

export function HomePage({ onOpenWorkspace, onOpenMcp }: HomePageProps) {
  const { t, i18n } = useTranslation();
  const { theme, resolved, setTheme } = useTheme();
  const settings = useSettings();
  const mcpInfo = useMcpInfo();
  const workspaces = useWorkspaces();
  const onError = useApiErrorHandler();
  const copyReference = useCopyAgentReference();
  const [importOpen, setImportOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>("relaxed");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  };

  const resetForm = (): void => {
    setName("");
    setDescription("");
    setMode("relaxed");
  };

  const openCreate = (): void => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (workspace: Workspace): void => {
    setName(workspace.name);
    setDescription(workspace.description ?? "");
    setMode(workspace.mode);
    setEditingWorkspace(workspace);
  };

  const closeForm = (): void => {
    if (saving) return;
    setCreateOpen(false);
    setEditingWorkspace(null);
    resetForm();
  };

  const save = async (): Promise<void> => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), description: description.trim() || null, mode };
      if (editingWorkspace) {
        await api.updateWorkspace(editingWorkspace.id, input);
        toast.success(t("home.updated"));
        refresh();
        setEditingWorkspace(null);
        resetForm();
        return;
      }

      const workspace = await api.createWorkspace(input);
      toast.success(t("home.created"));
      refresh();
      setCreateOpen(false);
      resetForm();
      onOpenWorkspace(workspace.id);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!deletingWorkspace) return;
    setDeleting(true);
    try {
      await api.deleteWorkspace(deletingWorkspace.id);
      queryClient.removeQueries({ queryKey: ["workspace", deletingWorkspace.id] });
      toast.success(t("home.deleted"));
      setDeletingWorkspace(null);
      refresh();
    } catch (error) {
      onError(error);
    } finally {
      setDeleting(false);
    }
  };

  const example = workspaces.data?.find((workspace) => workspace.id === EXAMPLE_ID);
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;
  const mcpReady = Boolean(mcpInfo.data) && !mcpInfo.isError;
  const endpoint = mcpInfo.data?.endpoint ?? `${window.location.origin}/mcp`;

  return (
    <div className="relative h-full overflow-y-auto bg-background selection:bg-primary/20">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-32 -top-56 h-[520px] w-[520px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -right-28 -top-44 h-[440px] w-[440px] rounded-full bg-sky-400/8 blur-3xl dark:bg-sky-400/5" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_35%,transparent)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] opacity-35" />
      </div>

      <header className="relative z-10 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 shadow-sm">
              <Logo size={21} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight">
                  {settings.data?.productName ?? PRODUCT.name}
                </span>
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[9px] font-normal text-muted-foreground"
                >
                  v{PRODUCT.version}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("home.productLabel")}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onOpenMcp} className="hidden sm:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${mcpReady ? "bg-success" : "bg-muted-foreground"}`}
              />
              MCP
              <span className="text-[10px] text-muted-foreground">
                {mcpReady ? t("home.ready") : t("home.unavailable")}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("home.appearanceAndLanguage")}>
                  <ThemeIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t("settings.theme")}</DropdownMenuLabel>
                {themes.map(({ value, icon: Icon }) => (
                  <DropdownMenuCheckboxItem
                    key={value}
                    checked={theme === value}
                    onCheckedChange={() => setTheme(value)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(`theme.${value}`)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
                {supportedLanguages.map((language) => (
                  <DropdownMenuCheckboxItem
                    key={language.code}
                    checked={i18n.resolvedLanguage === language.code}
                    onCheckedChange={() => void i18n.changeLanguage(language.code)}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    {language.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {t("home.overview")}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {t("home.workspaceHubTitle")}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("home.workspaceHubHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {example && (
              <Button variant="ghost" onClick={() => onOpenWorkspace(example.id)}>
                {t("home.openExample")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="h-3.5 w-3.5" />
              {t("home.importWorkspace")}
            </Button>
            <Button onClick={openCreate} className="shadow-sm shadow-primary/20">
              <Plus className="h-3.5 w-3.5" />
              {t("home.newWorkspace")}
            </Button>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3.5 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-muted-foreground">{t("home.allWorkspaces")}</p>
              <p className="mt-0.5 text-[14px] font-semibold">
                {t("home.workspaceCount", { count: workspaces.data?.length ?? 0 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenMcp}
            className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-accent/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
              <Plug className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">{t("home.mcpTitle")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${mcpReady ? "bg-success" : "bg-muted-foreground"}`}
                />
                {mcpReady ? t("home.connected") : t("home.unavailable")}
              </p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3.5 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <ThemeIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-muted-foreground">{t("settings.theme")}</p>
              <p className="mt-0.5 text-[14px] font-semibold">{t(`theme.${theme}`)}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold">{t("home.recentWorkspaces")}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t("home.recentHint")}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                {t("home.workspaceCount", { count: workspaces.data?.length ?? 0 })}
              </span>
            </div>

            <div className="divide-y divide-border/70">
              {workspaces.isLoading && (
                <p className="px-5 py-10 text-xs text-muted-foreground">{t("common.loading")}</p>
              )}
              {workspaces.data?.length === 0 && (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <p className="mt-3 text-[12px] text-muted-foreground">{t("home.noWorkspaces")}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                    {t("home.newWorkspace")}
                  </Button>
                </div>
              )}
              {workspaces.data?.map((workspace, index) => (
                <div
                  key={workspace.id}
                  className="group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-accent/45"
                >
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(workspace.id)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index % 3 === 0 ? "bg-primary/10 text-primary" : index % 3 === 1 ? "bg-violet-500/10 text-violet-500" : "bg-sky-500/10 text-sky-500"}`}
                    >
                      {index % 3 === 0 ? (
                        <Waypoints className="h-4 w-4" />
                      ) : index % 3 === 1 ? (
                        <Layers3 className="h-4 w-4" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{workspace.name}</span>
                        <Badge
                          variant="outline"
                          className="hidden h-4 px-1.5 text-[9px] font-normal text-muted-foreground sm:inline-flex"
                        >
                          {workspace.mode === "strict" ? t("home.strict") : t("home.relaxed")}
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {workspace.description || t("common.empty")}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-[10.5px] text-muted-foreground sm:block">
                      <div>{formatDateTime(workspace.updatedAt, i18n.language)}</div>
                      <div className="mt-0.5 font-mono opacity-70">
                        {t("home.revision", { revision: workspace.revision })}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("home.workspaceActions", { name: workspace.name })}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(workspace)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          void copyReference({
                            type: "workspace",
                            workspaceId: workspace.id,
                            targetId: workspace.id,
                            label: workspace.name,
                          })
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t("reference.copyWorkspace")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        destructive
                        onSelect={() => setDeletingWorkspace(workspace)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Plug className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${mcpReady ? "bg-success" : "bg-muted-foreground"}`}
                  />
                  {mcpReady ? t("home.connected") : t("home.unavailable")}
                </span>
              </div>
              <h2 className="mt-4 text-[14px] font-semibold">{t("home.mcpTitle")}</h2>
              <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                {t("home.mcpHint")}
              </p>
              <button
                type="button"
                onClick={onOpenMcp}
                className="mt-4 flex w-full items-center gap-2 rounded-lg border border-border bg-muted/55 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <Braces className="h-3.5 w-3.5 shrink-0 text-primary" />
                <code className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
                  {endpoint}
                </code>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {t("home.toolsAvailable", { count: mcpInfo.data?.tools.length ?? 0 })}
                </span>
                <Button variant="ghost" size="sm" onClick={onOpenMcp} className="-mr-2">
                  {t("home.viewConfiguration")}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold">{t("home.appearance")}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("home.appearanceHint")}
                  </p>
                </div>
                <ThemeIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {themes.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[10.5px] font-medium transition-all ${theme === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon className="h-3 w-3" />
                    {t(`theme.${value}`)}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                {t("home.activeTheme", { theme: t(`theme.${resolved}`) })}
              </p>
            </div>
          </div>
        </section>
      </main>

      {importOpen && (
        <ImportWorkspaceDialog
          onClose={() => setImportOpen(false)}
          onImported={(workspace) => {
            setImportOpen(false);
            toast.success(t("home.imported"));
            refresh();
            onOpenWorkspace(workspace.id);
          }}
        />
      )}

      <Dialog
        open={createOpen || Boolean(editingWorkspace)}
        onOpenChange={(open) => !open && closeForm()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(editingWorkspace ? "home.editTitle" : "home.createTitle")}</DialogTitle>
            <DialogDescription>
              {t(editingWorkspace ? "home.editHint" : "home.createHint")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="workspace-name">{t("common.name")}</Label>
              <Input
                id="workspace-name"
                value={name}
                autoFocus
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
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
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={!name.trim() || saving}>
              {t(editingWorkspace ? "common.save" : "common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingWorkspace)}
        onOpenChange={(open) => !open && !deleting && setDeletingWorkspace(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("home.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("home.deleteHint", { name: deletingWorkspace?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingWorkspace(null)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
