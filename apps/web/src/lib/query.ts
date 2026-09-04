import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  settings: ["settings"] as const,
  presets: ["presets"] as const,
  mcpInfo: ["mcp-info"] as const,
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  model: (id: string) => ["workspace", id, "model"] as const,
  views: (id: string) => ["workspace", id, "views"] as const,
  view: (viewId: string) => ["view", viewId] as const,
  records: (id: string) => ["workspace", id, "records"] as const,
  validation: (id: string) => ["workspace", id, "validation"] as const,
  activity: (id: string) => ["workspace", id, "activity"] as const,
  snapshots: (id: string) => ["workspace", id, "snapshots"] as const,
};

/** Everything that depends on a workspace revision. */
export function invalidateWorkspace(workspaceId: string): void {
  void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
  void queryClient.invalidateQueries({ queryKey: ["view"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
}
