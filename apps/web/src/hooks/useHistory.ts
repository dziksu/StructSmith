import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { invalidateWorkspace } from "@/lib/query";
import { useHistoryStore } from "@/store/history";
import { useApiErrorHandler } from "./useApi";

export function useHistory(workspaceId: string) {
  const { t } = useTranslation();
  const onError = useApiErrorHandler();
  const { undoStack, redoStack, popUndo, popRedo, pushUndo, pushRedo } = useHistoryStore();

  const apply = useCallback(
    async (
      entry: import("@/store/history").HistoryEntry,
      register: (entry: import("@/store/history").HistoryEntry) => void,
    ) => {
      if (entry.kind === "snapshot") {
        const result = await api.restoreSnapshot(entry.snapshotId);
        register({ kind: "snapshot", snapshotId: result.snapshotId, label: entry.label });
      } else {
        const view = await api.getView(entry.viewId);
        const previous = entry.entries.map(({ elementId }) => {
          const current = view.elements.find((item) => item.elementId === elementId);
          return { elementId, x: current?.x ?? 0, y: current?.y ?? 0 };
        });
        await api.saveLayout(entry.viewId, { entries: entry.entries });
        register({ kind: "layout", viewId: entry.viewId, entries: previous, label: entry.label });
      }
      invalidateWorkspace(workspaceId);
    },
    [workspaceId],
  );

  const undo = useCallback(async () => {
    const entry = popUndo();
    if (!entry) {
      toast.message(t("toast.nothingToUndo"));
      return;
    }
    try {
      await apply(entry, pushRedo);
      toast.success(t("toast.undone"));
    } catch (error) {
      onError(error);
    }
  }, [apply, onError, popUndo, pushRedo, t]);

  const redo = useCallback(async () => {
    const entry = popRedo();
    if (!entry) {
      toast.message(t("toast.nothingToRedo"));
      return;
    }
    try {
      await apply(entry, pushUndo);
      toast.success(t("toast.redone"));
    } catch (error) {
      onError(error);
    }
  }, [apply, onError, popRedo, pushUndo, t]);

  return { undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
