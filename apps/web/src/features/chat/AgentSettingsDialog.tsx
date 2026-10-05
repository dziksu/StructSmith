import type { AgentSettings } from "@structsmith/contracts";
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
import { chatApi } from "./api";

export const providerNames = { codex: "Codex", claude: "Claude Code", copilot: "GitHub Copilot" };

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
        <select
          id="agent-default"
          className="rounded border bg-background px-2 py-1.5 text-sm"
          value={draft.defaultProvider}
          onChange={(event) =>
            setDraft({
              ...draft,
              defaultProvider: event.target.value as AgentSettings["defaultProvider"],
            })
          }
        >
          {Object.entries(providerNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
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
              onChange={(event) =>
                setDraft({
                  ...draft,
                  providers: {
                    ...draft.providers,
                    [provider]: { ...draft.providers[provider], model: event.target.value },
                  },
                })
              }
            />
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
