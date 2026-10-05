import type {
  AgentProvider,
  AgentSettings,
  CodexModel,
  CodexReasoningEffort,
} from "@structsmith/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { chatApi } from "./api";

export const providerNames = { codex: "Codex", claude: "Claude Code", copilot: "GitHub Copilot" };
const fallbackEfforts: CodexReasoningEffort[] = ["low", "medium", "high", "xhigh", "max", "ultra"];

export function AgentSettingsDialog({
  settings,
  codexModels,
  onClose,
  onSave,
}: {
  settings: AgentSettings;
  codexModels: CodexModel[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const modelCapabilities = codexModels.find(
    (model) => model.id === draft.providers.codex.model.trim(),
  );
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("chat.settings")}</DialogTitle>
          <DialogDescription>{t("chat.settingsHint")}</DialogDescription>
        </DialogHeader>
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
        {(["codex", "claude", "copilot"] as const).map((provider) => (
          <fieldset key={provider} className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">{providerNames[provider]}</legend>
            <Label htmlFor={`agent-path-${provider}`}>{t("chat.executable")}</Label>
            <Input
              id={`agent-path-${provider}`}
              value={draft.providers[provider].executable}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  providers: {
                    ...draft.providers,
                    [provider]: { ...draft.providers[provider], executable: event.target.value },
                  },
                })
              }
            />
            <Label htmlFor={`agent-model-${provider}`}>{t("chat.model")}</Label>
            <Input
              id={`agent-model-${provider}`}
              placeholder={t("chat.defaultModel")}
              value={draft.providers[provider].model}
              onChange={(event) => changeModel(provider, event.target.value)}
            />
            {provider === "codex" && (
              <>
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
                  <SelectTrigger id="agent-reasoning-codex" aria-describedby="agent-reasoning-hint">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t("chat.defaultReasoningEffort")}</SelectItem>
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
              </>
            )}
          </fieldset>
        ))}
        <Button
          disabled={saving || Object.values(draft.providers).some((p) => !p.executable.trim())}
          onClick={() => void save()}
        >
          {t("common.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
