import type { AgentChat, AgentProvider, ChatContext } from "@structsmith/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowUp,
  Check,
  FolderOpen,
  Loader2,
  MessageCircle,
  Plus,
  Settings2,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaces } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { AgentSettingsDialog, providerNames } from "./AgentSettingsDialog";
import { chatApi } from "./api";
import { useChatStore } from "./store";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const selectStyle = "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs";

export function AgentChatDock() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { open, setOpen, currentProject, request, clearRequest } = useChatStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scope, setScope] = useState("all");
  const [newScope, setNewScope] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [context, setContext] = useState<ChatContext | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<number | null>(null);
  const settings = useQuery({
    queryKey: ["agent-settings"],
    queryFn: chatApi.settings,
    enabled: open,
    retry: false,
  });
  const topics = useQuery({
    queryKey: ["agent-chats"],
    queryFn: chatApi.list,
    enabled: open,
    refetchInterval: (query) => (query.state.data?.some((chat) => chat.running) ? 1500 : false),
  });
  const chat = useQuery({
    queryKey: ["agent-chat", activeId],
    queryFn: () => chatApi.get(activeId as string),
    enabled: open && Boolean(activeId),
    refetchInterval: (query) =>
      query.state.data?.messages.some((message) => message.status === "running") ? 700 : false,
  });
  const workspaces = useWorkspaces();
  const current = chat.data?.id === activeId ? chat.data : undefined;
  const running = current?.messages.some((message) => message.status === "running") ?? false;
  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["agent-chats"] });
  };
  const accept = (next: AgentChat) => {
    cache.setQueryData(["agent-chat", next.id], next);
    setActiveId(next.id);
    refresh();
  };
  const create = async (workspaceId: string | null, target?: ChatContext) => {
    const next = await chatApi.create({
      workspaceId,
      provider: settings.data?.settings.defaultProvider ?? "codex",
      context: target,
    });
    accept(next);
    setContext(target);
    setScope("all");
    setDetailsOpen(false);
    return next;
  };
  const update = async (input: Parameters<typeof chatApi.update>[1]) => {
    if (!activeId) return;
    setBusy(true);
    try {
      accept(await chatApi.update(activeId, input));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open) composer.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open || !request || !settings.data || handledRequest.current === request.nonce) return;
    handledRequest.current = request.nonce;
    setBusy(true);
    const apply = async () => {
      try {
        if (current?.workspaceId === request.workspaceId && !running) setContext(request.context);
        else await create(request.workspaceId, request.context);
        clearRequest();
        composer.current?.focus();
      } catch (error) {
        toast.error(errorMessage(error));
        clearRequest();
      } finally {
        setBusy(false);
      }
    };
    void apply();
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: message changes are the scroll trigger.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [current?.messages.length, current?.messages.at(-1)?.text, current?.messages.at(-1)?.status]);
  const submit = async () => {
    if (!current || !draft.trim() || running || busy) return;
    const id = current.id;
    setBusy(true);
    try {
      accept(await chatApi.message(id, { text: draft, context }));
      setDrafts((values) => ({ ...values, [id]: "" }));
      setContext(undefined);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      composer.current?.focus();
    }
  };
  const choose = (id: string) => {
    setActiveId(id);
    setContext(undefined);
    setDetailsOpen(false);
  };
  const available = settings.data?.availability.find((item) => item.provider === current?.provider);
  const filtered =
    topics.data?.filter(
      (topic) =>
        scope === "all" || (scope === "general" ? !topic.workspaceId : topic.workspaceId === scope),
    ) ?? [];
  const projectOptions = workspaces.data ?? [];

  return (
    <>
      {!open && (
        <Button
          className="fixed bottom-10 right-4 z-40 gap-2 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-4 w-4" />
          {t("chat.title")}
        </Button>
      )}
      {open && (
        <aside
          aria-label={t("chat.title")}
          className="fixed bottom-10 right-3 top-14 z-40 flex w-[min(760px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{t("chat.title")}</h2>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t("chat.localCli")}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("chat.settings")}
                disabled={!settings.data}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>
          {settings.isError ? (
            <div className="m-4 space-y-3 rounded-lg border p-4 text-sm">
              <p>{errorMessage(settings.error)}</p>
              <Button variant="outline" onClick={() => void settings.refetch()}>
                {t("chat.retry")}
              </Button>
            </div>
          ) : !settings.data ? (
            <p className="p-4 text-sm">{t("common.loading")}</p>
          ) : (
            <div className="flex min-h-0 flex-1">
              <nav
                aria-label={t("chat.topics")}
                className="flex w-48 shrink-0 flex-col border-r bg-muted/20 max-sm:w-32"
              >
                <div className="space-y-2 border-b p-3">
                  <label
                    className="block text-[11px] text-muted-foreground"
                    htmlFor="chat-new-scope"
                  >
                    {t("chat.newIn")}
                  </label>
                  <select
                    id="chat-new-scope"
                    className={cn(selectStyle, "w-full")}
                    value={newScope ?? currentProject?.id ?? "general"}
                    onChange={(event) => setNewScope(event.target.value)}
                  >
                    <option value="general">{t("chat.general")}</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="w-full gap-1"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void create(
                        (newScope ?? currentProject?.id ?? "general") === "general"
                          ? null
                          : (newScope ?? currentProject?.id ?? null),
                      )
                        .catch((error) => toast.error(errorMessage(error)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("chat.newTopic")}
                  </Button>
                  <select
                    aria-label={t("chat.filter")}
                    className={cn(selectStyle, "w-full")}
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                  >
                    <option value="all">{t("chat.allTopics")}</option>
                    <option value="general">{t("chat.general")}</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {topics.isError && (
                    <p className="p-2 text-xs text-destructive">{errorMessage(topics.error)}</p>
                  )}
                  {filtered.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => choose(topic.id)}
                      className={cn(
                        "mb-1 w-full rounded-md p-2 text-left hover:bg-accent",
                        activeId === topic.id && "bg-accent",
                      )}
                    >
                      <span className="flex items-center gap-1 text-xs font-medium">
                        {topic.running && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
                        <span className="truncate">{topic.title || t("chat.untitled")}</span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                        {topic.workspaceName ?? t("chat.general")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {providerNames[topic.provider]}
                      </span>
                    </button>
                  ))}
                  {!topics.isLoading && !filtered.length && (
                    <p className="p-2 text-xs text-muted-foreground">{t("chat.noTopics")}</p>
                  )}
                </div>
              </nav>
              {!current ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("chat.welcome")}</p>
                  <p className="text-xs text-muted-foreground">
                    {chat.isError ? errorMessage(chat.error) : t("chat.welcomeHint")}
                  </p>
                </div>
              ) : (
                <section className="flex min-w-0 flex-1 flex-col">
                  <div className="space-y-2 border-b px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={
                          !current.workspaceId ||
                          !projectOptions.some((project) => project.id === current.workspaceId)
                        }
                        className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary"
                        onClick={() => {
                          if (current.workspaceId)
                            void navigate({
                              to: "/w/$workspaceId",
                              params: { workspaceId: current.workspaceId },
                            });
                        }}
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {current.workspaceName ?? t("chat.general")}
                        </span>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("chat.topicSettings")}
                        onClick={() => setDetailsOpen((value) => !value)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label={t("chat.provider")}
                        className={cn(selectStyle, "flex-1")}
                        value={current.provider}
                        disabled={running || busy}
                        onChange={(event) =>
                          void update({ provider: event.target.value as AgentProvider })
                        }
                      >
                        {Object.entries(providerNames).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={t("chat.mode")}
                        className={selectStyle}
                        value={current.mode}
                        disabled={running || busy}
                        onChange={(event) =>
                          void update({ mode: event.target.value as AgentChat["mode"] })
                        }
                      >
                        <option value="ask">{t("chat.askMode")}</option>
                        <option
                          value="edit"
                          disabled={!current.workspaceId || settings.data.readOnly}
                        >
                          {t("chat.editMode")}
                        </option>
                      </select>
                    </div>
                    {current.mode === "edit" && (
                      <p className="text-[11px] text-primary">{t("chat.editHint")}</p>
                    )}
                    {available && !available.available && (
                      <p className="text-[11px] text-destructive">
                        {t("chat.missingCli")}{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setSettingsOpen(true)}
                        >
                          {t("chat.settings")}
                        </button>
                      </p>
                    )}
                    {detailsOpen && (
                      <TopicSettings
                        key={current.id}
                        chat={current}
                        disabled={running || busy}
                        onUpdate={(input) => void update(input)}
                        onDelete={() => {
                          setBusy(true);
                          void chatApi
                            .remove(current.id)
                            .then(() => {
                              setActiveId(null);
                              setContext(undefined);
                              refresh();
                            })
                            .catch((error) => toast.error(errorMessage(error)))
                            .finally(() => setBusy(false));
                        }}
                      />
                    )}
                  </div>
                  <div
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
                    aria-live="polite"
                    aria-relevant="additions text"
                  >
                    {!current.messages.length && (
                      <p className="text-xs text-muted-foreground">{t("chat.emptyHint")}</p>
                    )}
                    {current.messages.map((message) => (
                      <article
                        key={message.id}
                        className={cn(
                          "rounded-lg p-3",
                          message.role === "user"
                            ? "ml-6 bg-primary/10"
                            : "mr-2 border bg-background",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                          {message.role === "user"
                            ? t("chat.you")
                            : providerNames[message.provider]}
                          {message.status === "running" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </div>
                        {message.context && (
                          <p
                            className="mb-2 truncate rounded border px-2 py-1 text-[10px] text-primary"
                            title={message.context.targetId}
                          >
                            {message.context.label ?? message.context.targetId}
                          </p>
                        )}
                        <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                          {message.text}
                        </div>
                        {message.status === "running" && (
                          <p className="mt-2 break-words text-[11px] text-muted-foreground">
                            {message.progress ?? t("chat.working")}
                          </p>
                        )}
                        {message.error && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-xs text-destructive">
                            {message.error}
                          </p>
                        )}
                        {message.status === "cancelled" && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t("chat.cancelled")}
                          </p>
                        )}
                      </article>
                    ))}
                    <div ref={end} />
                  </div>
                  <form
                    className="space-y-2 border-t p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                  >
                    {context && (
                      <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px] text-primary">
                        <span className="truncate">
                          {t("chat.context")}: {context.label ?? context.targetId}
                        </span>
                        <button
                          type="button"
                          aria-label={t("chat.removeContext")}
                          onClick={() => setContext(undefined)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <Textarea
                      ref={composer}
                      aria-label={t("chat.message")}
                      placeholder={context ? t("chat.contextPlaceholder") : t("chat.placeholder")}
                      className="min-h-20 max-h-40 resize-y text-sm"
                      value={draft}
                      maxLength={20000}
                      onChange={(event) =>
                        setDrafts((values) => ({ ...values, [current.id]: event.target.value }))
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {t("chat.sendHint")}
                      </span>
                      {running ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void chatApi
                              .stop(current.id)
                              .then(accept)
                              .catch((error) => toast.error(errorMessage(error)))
                          }
                        >
                          <Square className="mr-1 h-3 w-3" />
                          {t("chat.stop")}
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!draft.trim() || busy || !available?.available}
                        >
                          <ArrowUp className="mr-1 h-3.5 w-3.5" />
                          {t("chat.send")}
                        </Button>
                      )}
                    </div>
                  </form>
                </section>
              )}
            </div>
          )}
        </aside>
      )}
      {settingsOpen && settings.data && (
        <AgentSettingsDialog
          settings={settings.data.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={() => void cache.invalidateQueries({ queryKey: ["agent-settings"] })}
        />
      )}
    </>
  );
}

function TopicSettings({
  chat,
  disabled,
  onUpdate,
  onDelete,
}: {
  chat: AgentChat;
  disabled: boolean;
  onUpdate: (input: Parameters<typeof chatApi.update>[1]) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(chat.title);
  const [directory, setDirectory] = useState(chat.directory);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
      <label className="block text-[11px]" htmlFor="chat-topic-title">
        {t("chat.topicTitle")}
      </label>
      <Input
        id="chat-topic-title"
        value={title}
        maxLength={200}
        disabled={disabled}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="block text-[11px]" htmlFor="chat-directory">
        {t("chat.directory")}
      </label>
      <Input
        id="chat-directory"
        placeholder="/absolute/path/to/project"
        value={directory}
        disabled={disabled}
        onChange={(event) => setDirectory(event.target.value)}
      />
      <p className="text-[10px] text-muted-foreground">{t("chat.directoryHint")}</p>
      <div className="flex justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (confirmDelete) onDelete();
            else setConfirmDelete(true);
          }}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          {t(confirmDelete ? "chat.confirmDelete" : "common.delete")}
        </Button>
        <Button
          size="sm"
          disabled={disabled || !title.trim()}
          onClick={() => onUpdate({ title, directory })}
        >
          <Check className="mr-1 h-3 w-3" />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
