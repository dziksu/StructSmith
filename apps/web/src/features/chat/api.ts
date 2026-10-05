import type {
  AgentChat,
  AgentChatStreamEvent,
  AgentChatSummary,
  AgentSettings,
  AgentSettingsResponse,
  CodexModel,
  CreateAgentChat,
  ReorderAgentChats,
  SendAgentMessage,
  UpdateAgentChat,
} from "@structsmith/contracts";
import { getToken, request } from "@/lib/api";
import { readChatEvents } from "./stream";

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const chatApi = {
  settings: () => request<AgentSettingsResponse>("/agent-chat/settings"),
  codexModels: (executable: string, signal?: AbortSignal) =>
    request<CodexModel[]>(`/agent-chat/codex/models?executable=${encodeURIComponent(executable)}`, {
      signal,
    }),
  saveSettings: (settings: AgentSettings) =>
    request<AgentSettings>("/agent-chat/settings", send("PUT", settings)),
  list: () => request<AgentChatSummary[]>("/agent-chat/chats"),
  reorder: (input: ReorderAgentChats) =>
    request<AgentChatSummary[]>("/agent-chat/chats/order", send("PUT", input)),
  get: (id: string, signal?: AbortSignal) =>
    request<AgentChat>(`/agent-chat/chats/${id}`, { signal }),
  events: async (
    id: string,
    signal: AbortSignal,
    onEvent: (event: AgentChatStreamEvent) => void,
  ) => {
    const token = getToken();
    const response = await fetch(`/api/agent-chat/chats/${id}/events`, {
      signal,
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok || !response.body) throw new Error(`Chat stream failed: ${response.status}`);
    await readChatEvents(response.body, onEvent);
  },
  create: (input: CreateAgentChat) => request<AgentChat>("/agent-chat/chats", send("POST", input)),
  update: (id: string, input: UpdateAgentChat) =>
    request<AgentChat>(`/agent-chat/chats/${id}`, send("PATCH", input)),
  remove: (id: string) => request<void>(`/agent-chat/chats/${id}`, send("DELETE")),
  message: (id: string, input: SendAgentMessage) =>
    request<AgentChat>(`/agent-chat/chats/${id}/messages`, send("POST", input)),
  stop: (id: string) => request<AgentChat>(`/agent-chat/chats/${id}/stop`, send("POST")),
};
