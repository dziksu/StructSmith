import type { AgentProvider, AgentSettings, CodexReasoningEffort } from "@structsmith/contracts";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { chatApi } from "./api";

export const providerNames = { codex: "Codex", claude: "Claude Code", copilot: "GitHub Copilot" };
const fallbackEfforts: CodexReasoningEffort[] = ["low", "medium", "high", "xhigh", "max", "ultra"];

export function AgentSettingsDialog({
  settings,
  onClose,
  onSave,
}: {
  settings: AgentSettings;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [catalogExecutable, setCatalogExecutable] = useState(settings.providers.codex.executable);
  const [customModel, setCustomModel] = useState(false);
  const catalog = useQuery({
    queryKey: ["agent-codex-models", catalogExecutable],
    queryFn: ({ signal }) => chatApi.codexModels(catalogExecutable, signal),
    enabled: Boolean(catalogExecutable.trim()),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const catalogStale = draft.providers.codex.executable.trim() !== catalogExecutable;
  const codexModels = catalogStale ? [] : (catalog.data ?? []);
  const modelCapabilities = codexModels.find(
    (model) => model.id === draft.providers.codex.model.trim(),
  );
  const customModelActive =
    customModel || Boolean(draft.providers.codex.model && !modelCapabilities);
  const reasoningEfforts = modelCapabilities?.reasoningEfforts ?? fallbackEfforts;
  const changeModel = (provider: AgentProvider, model: string) => {
    setDraft((previous) => {
      const providers = {
        ...previous.providers,
        [provider]: { ...previous.providers[provider], model },
      };
      const efforts =
        codexModels.find((item) => item.id === model.trim())?.reasoningEfforts ?? fallbackEfforts;
      if (
        provider === "codex" &&
        providers.codex.reasoningEffort !== "default" &&
        !efforts.includes(providers.codex.reasoningEffort)
      ) {
        providers.codex = { ...providers.codex, reasoningEffort: "default" };
      }
      return { ...previous, providers };
    });
  };
  const save = async () => {
    setSaving(true);
    try {
      await chatApi.saveSettings(draft);
      onSave();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-h-[90dvh]">
        <DialogHeader className="mb-0 px-6 pb-5 pt-6">
          <DialogTitle>{t("chat.settings")}</DialogTitle>
          <DialogDescription>{t("chat.settingsHint")}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0">
          <div className="space-y-6 px-6 pb-2">
            <div className="grid gap-1.5">
              <Label htmlFor="agent-default">{t("chat.defaultProvider")}</Label>
              <Select
                value={draft.defaultProvider}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    defaultProvider: value as AgentSettings["defaultProvider"],
                  })
                }
              >
                <SelectTrigger id="agent-default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(providerNames).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(["codex", "claude", "copilot"] as const).map((provider) => (
              <fieldset key={provider} className="min-w-0">
                <legend className="mb-3 p-0 text-sm font-semibold">
                  {providerNames[provider]}
                </legend>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`agent-path-${provider}`}>{t("chat.executable")}</Label>
                    <Input
                      id={`agent-path-${provider}`}
                      value={draft.providers[provider].executable}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          providers: {
                            ...draft.providers,
                            [provider]: {
                              ...draft.providers[provider],
                              executable: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`agent-model-${provider}`}>{t("chat.model")}</Label>
                    {provider === "codex" ? (
                      <>
                        <div className="flex gap-2">
                          <Select
                            value={
                              customModelActive
                                ? "__custom__"
                                : draft.providers.codex.model || "__default__"
                            }
                            onValueChange={(value) => {
                              setCustomModel(value === "__custom__");
                              if (value !== "__custom__")
                                changeModel("codex", value === "__default__" ? "" : value);
                            }}
                          >
                            <SelectTrigger
                              id="agent-model-codex"
                              aria-describedby="agent-model-hint"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">{t("chat.defaultModel")}</SelectItem>
                              {codexModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.displayName ?? model.id}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">{t("chat.customModel")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            aria-label={t("chat.refreshModels")}
                            title={t("chat.refreshModels")}
                            disabled={
                              !draft.providers.codex.executable.trim() ||
                              (catalog.isFetching && !catalogStale)
                            }
                            onClick={() => {
                              if (catalogStale)
                                setCatalogExecutable(draft.providers.codex.executable.trim());
                              else void catalog.refetch();
                            }}
                          >
                            {catalog.isFetching && !catalogStale ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        {customModelActive && (
                          <>
                            <Label className="sr-only" htmlFor="agent-model-custom-codex">
                              {t("chat.customModel")}
                            </Label>
                            <Input
                              id="agent-model-custom-codex"
                              placeholder={t("chat.modelId")}
                              value={draft.providers.codex.model}
                              onChange={(event) => changeModel("codex", event.target.value)}
                              aria-describedby="agent-model-hint"
                            />
                          </>
                        )}
                        <p
                          id="agent-model-hint"
                          className="text-xs text-muted-foreground"
                          aria-live="polite"
                        >
                          {t(
                            catalogStale
                              ? "chat.modelsPathChanged"
                              : catalog.isFetching
                                ? "chat.modelsLoading"
                                : catalog.isError || !codexModels.length
                                  ? "chat.modelsUnavailable"
                                  : "chat.modelsHint",
                          )}
                          {draft.providers.codex.model &&
                            !modelCapabilities &&
                            !catalog.isFetching && <> {t("chat.modelNotListed")}</>}
                        </p>
                      </>
                    ) : (
                      <Input
                        id={`agent-model-${provider}`}
                        placeholder={t("chat.defaultModel")}
                        value={draft.providers[provider].model}
                        onChange={(event) => changeModel(provider, event.target.value)}
                      />
                    )}
                  </div>
                  {provider === "codex" && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="agent-reasoning-codex">{t("chat.reasoningEffort")}</Label>
                      <Select
                        value={draft.providers.codex.reasoningEffort}
                        onValueChange={(value) =>
                          setDraft({
                            ...draft,
                            providers: {
                              ...draft.providers,
                              codex: {
                                ...draft.providers.codex,
                                reasoningEffort:
                                  value as AgentSettings["providers"]["codex"]["reasoningEffort"],
                              },
                            },
                          })
                        }
                      >
                        <SelectTrigger
                          id="agent-reasoning-codex"
                          aria-describedby="agent-reasoning-hint"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            {t("chat.defaultReasoningEffort")}
                          </SelectItem>
                          {reasoningEfforts.map((effort) => (
                            <SelectItem key={effort} value={effort}>
                              {t(`chat.reasoningLevels.${effort}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p id="agent-reasoning-hint" className="text-xs text-muted-foreground">
                        {t("chat.reasoningHint")}
                        {!modelCapabilities && <> {t("chat.reasoningCatalogMissing")}</>}
                      </p>
                    </div>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-0 px-6 pb-6 pt-4">
          <Button
            disabled={saving || Object.values(draft.providers).some((p) => !p.executable.trim())}
            onClick={() => void save()}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
