import type { ArchitectureOperationInput } from "@structsmith/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { invalidateWorkspace, queryKeys } from "@/lib/query";
import { useEditorStore } from "@/store/editor";
import { useHistoryStore } from "@/store/history";

export const useSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: api.getSettings, staleTime: Infinity });

export const usePresets = () =>
  useQuery({ queryKey: queryKeys.presets, queryFn: api.getPresets, staleTime: Infinity });

export const useMcpInfo = () => useQuery({ queryKey: queryKeys.mcpInfo, queryFn: api.getMcpInfo });

export const useWorkspaces = () =>
  useQuery({ queryKey: queryKeys.workspaces, queryFn: api.listWorkspaces });

export const useWorkspace = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.workspace(workspaceId),
    queryFn: () => api.getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useModel = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.model(workspaceId),
    queryFn: () => api.getModel(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useViews = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.views(workspaceId),
    queryFn: () => api.listViews(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useView = (viewId: string | null) =>
  useQuery({
    queryKey: queryKeys.view(viewId ?? "none"),
    queryFn: () => api.getView(viewId as string),
    enabled: Boolean(viewId),
  });

export const useRecords = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.records(workspaceId),
    queryFn: () => api.listRecords(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useValidation = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.validation(workspaceId),
    queryFn: () => api.validate(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useActivity = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.activity(workspaceId),
    queryFn: () => api.getActivity(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useSnapshots = (workspaceId: string) =>
  useQuery({
    queryKey: queryKeys.snapshots(workspaceId),
    queryFn: () => api.listSnapshots(workspaceId),
    enabled: Boolean(workspaceId),
  });

/** Turns any API failure into a toast with the server-provided message. */
export function useApiErrorHandler(): (error: unknown) => void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.isConflict) {
        toast.warning(t("toast.conflict"));
        void queryClient.invalidateQueries();
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.error(t("common.error"));
  };
}

export interface CommandInput {
  operations: ArchitectureOperationInput[];
  label: string;
  /** Skip the undo entry (used by the undo/redo machinery itself). */
  silent?: boolean;
}

/**
 * Every UI mutation goes through the batch command endpoint, which gives us
 * atomicity, a revision guard and an automatic snapshot for undo.
 */
export function useApplyOperations(workspaceId: string) {
  const onError = useApiErrorHandler();
  const push = useHistoryStore((state) => state.push);
  const beginSave = useEditorStore((state) => state.beginSave);
  const endSave = useEditorStore((state) => state.endSave);

  return useMutation({
    mutationFn: async ({ operations, label }: CommandInput) => {
      beginSave();
      try {
        return await api.applyOperations(workspaceId, {
          operations: operations as never,
          label,
        });
      } finally {
        endSave();
      }
    },
    onSuccess: (result, variables) => {
      if (!variables.silent && result.snapshotId) {
        push({ kind: "snapshot", snapshotId: result.snapshotId, label: variables.label });
      }
      invalidateWorkspace(workspaceId);
    },
    onError,
  });
}
