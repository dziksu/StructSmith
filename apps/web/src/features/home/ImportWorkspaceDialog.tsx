import type { Workspace } from "@structsmith/contracts";
import { AlertCircle, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
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
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { parseWorkspaceImport } from "@/lib/workspaceImport";

interface ImportWorkspaceDialogProps {
  onClose: () => void;
  onImported: (workspace: Workspace) => void;
}

export function ImportWorkspaceDialog({ onClose, onImported }: ImportWorkspaceDialogProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState<ReturnType<typeof parseWorkspaceImport> | null>(null);
  const [name, setName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameEdited = useRef(false);
  const readVersion = useRef(0);
  const submitting = useRef(false);

  useEffect(
    () => () => {
      readVersion.current += 1;
    },
    [],
  );

  const clearFile = (): void => {
    readVersion.current += 1;
    setFile(null);
    setInput(null);
    setReading(false);
    setError(null);
    if (!nameEdited.current) setName("");
  };

  const { getRootProps, getInputProps, open, isDragActive, isProcessing } = useDropzone({
    // No native accept filter: macOS may disable unfamiliar .mmd/.mermaid files.
    // The existing import adapter and domain service validate the contents instead.
    multiple: false,
    maxSize: 16 * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
    useFsAccessApi: false,
    disabled: saving || reading,
    onDrop: (accepted, rejected) => {
      clearFile();
      if (rejected.length) {
        setError(
          t(
            rejected.some((entry) => entry.errors.some((item) => item.code === "file-too-large"))
              ? "home.importTooLarge"
              : "home.importOneFile",
          ),
        );
        return;
      }
      const next = accepted[0];
      if (!next) return;
      setFile(next);
      setReading(true);
      const version = readVersion.current;
      void next
        .text()
        .then((content) => {
          if (version !== readVersion.current) return;
          if (!content.trim()) {
            setError(t("home.importEmpty"));
            return;
          }
          try {
            const parsed = parseWorkspaceImport(next.name, content);
            if (parsed.kind === "mermaid" && parsed.source.length > 1_000_000) {
              setError(t("home.importMermaidTooLarge"));
              return;
            }
            setInput(parsed);
            if (!nameEdited.current) {
              const suggested =
                parsed.kind === "json"
                  ? parsed.document.workspace.name
                  : next.name.replace(/\.[^.]+$/, "");
              setName((suggested || t("common.unnamed")).slice(0, 200));
            }
          } catch {
            setError(t("home.importInvalidJson"));
          }
        })
        .catch(() => {
          if (version === readVersion.current) setError(t("home.importReadFailed"));
        })
        .finally(() => {
          if (version === readVersion.current) setReading(false);
        });
    },
    onError: () => setError(t("home.importReadFailed")),
  });

  const submit = async (): Promise<void> => {
    if (!input || !name.trim() || reading || isProcessing || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const workspace =
        input.kind === "json"
          ? await api.importWorkspace(input.document, name.trim())
          : await api.importMermaidWorkspace(input.source, name.trim());
      onImported(workspace);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("home.importFailed"));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const busy = saving || reading || isProcessing;

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !submitting.current) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-5 sm:p-6"
        hideClose={saving}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          aria-busy={busy}
        >
          <DialogHeader>
            <DialogTitle className="text-base">{t("home.importTitle")}</DialogTitle>
            <DialogDescription>{t("home.importDialogHint")}</DialogDescription>
          </DialogHeader>

          <div
            {...getRootProps({
              role: "group",
              "aria-label": t("home.importDropLabel"),
              className: cn(
                "relative mt-5 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors",
                "bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_75%)]",
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40",
                busy && "opacity-60",
              ),
            })}
          >
            <input {...getInputProps({ "aria-label": t("home.importFile") })} />
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              {reading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-sm font-medium">
                {reading
                  ? t("home.importReading")
                  : isDragActive
                    ? t("home.importDropActive")
                    : t("home.importDropPrompt")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("home.importFormats")}</p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={open}>
              {file ? t("home.importChangeFile") : t("home.importFile")}
            </Button>
          </div>

          {file && (
            <div
              className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
              aria-live="polite"
            >
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Intl.NumberFormat(i18n.language, {
                    style: "unit",
                    unit: "kilobyte",
                    maximumFractionDigits: 1,
                  }).format(file.size / 1024)}
                </p>
              </div>
              {input && (
                <Badge variant="outline">{input.kind === "json" ? "JSON" : "Mermaid"}</Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={saving}
                onClick={clearFile}
                aria-label={t("home.importRemoveFile")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <Label htmlFor={`${id}-name`}>{t("home.importWorkspaceName")}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={200}
              required
              disabled={saving}
              placeholder={t("home.importNamePlaceholder")}
              aria-describedby={`${id}-name-hint`}
              onChange={(event) => {
                nameEdited.current = true;
                setName(event.target.value);
              }}
            />
            <p id={`${id}-name-hint`} className="text-xs text-muted-foreground">
              {t("home.importNameHint")}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="min-w-0 break-words">{error}</p>
            </div>
          )}

          <DialogFooter className="mt-6 border-t border-border/70 pt-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!input || !name.trim() || busy}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saving ? t("home.importSubmitting") : t("home.importSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
