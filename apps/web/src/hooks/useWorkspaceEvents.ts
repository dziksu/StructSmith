import { useEffect } from "react";
import { invalidateWorkspace } from "@/lib/query";

/**
 * Keeps the UI in sync when an MCP client changes the model (spec §26).
 * The event only carries the revision — the actual data is refetched by
 * TanStack Query.
 */
export function useWorkspaceEvents(workspaceId: string | null): void {
  useEffect(() => {
    if (!workspaceId) return;

    const source = new EventSource(`/api/events?workspaceId=${encodeURIComponent(workspaceId)}`);

    const onUpdate = (): void => invalidateWorkspace(workspaceId);
    source.addEventListener("workspace.updated", onUpdate);
    source.addEventListener("workspace.deleted", onUpdate);

    return () => {
      source.removeEventListener("workspace.updated", onUpdate);
      source.removeEventListener("workspace.deleted", onUpdate);
      source.close();
    };
  }, [workspaceId]);
}
