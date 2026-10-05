import type { ChatContext } from "@structsmith/contracts";
import { create } from "zustand";
import type { AgentReferenceInput } from "@/lib/agentReference";

interface ChatState {
  open: boolean;
  currentProject: { id: string; name: string } | null;
  request: { workspaceId: string; context: ChatContext; nonce: number } | null;
  setOpen: (open: boolean) => void;
  setProject: (project: ChatState["currentProject"]) => void;
  ask: (reference: AgentReferenceInput) => void;
  clearRequest: () => void;
}
export const useChatStore = create<ChatState>((set) => ({
  open: false,
  currentProject: null,
  request: null,
  setOpen: (open) => set({ open }),
  setProject: (currentProject) => set({ currentProject }),
  clearRequest: () => set({ request: null }),
  ask: (ref) =>
    set({
      open: true,
      request: {
        workspaceId: ref.workspaceId,
        context: {
          type: ref.type,
          targetId: ref.targetId,
          label: ref.label,
          viewId: ref.viewId ?? undefined,
        },
        nonce: Date.now(),
      },
    }),
}));
