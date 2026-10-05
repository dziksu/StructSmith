import type {
  AgentAvailability,
  AgentChat,
  AgentChatSummary,
  AgentSettings,
  CreateAgentChat,
  SendAgentMessage,
  UpdateAgentChat,
} from "@structsmith/contracts";
import { request } from "@/lib/api";

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const chatApi = {
  settings: () =>
    request<{ settings: AgentSettings; availability: AgentAvailability[]; readOnly: boolean }>(
      "/agent-chat/settings",
    ),
  saveSettings: (settings: AgentSettings) =>
    request<AgentSettings>("/agent-chat/settings", send("PUT", settings)),
  list: () => request<AgentChatSummary[]>("/agent-chat/chats"),
  get: (id: string) => request<AgentChat>(`/agent-chat/chats/${id}`),
  create: (input: CreateAgentChat) => request<AgentChat>("/agent-chat/chats", send("POST", input)),
  update: (id: string, input: UpdateAgentChat) =>
    request<AgentChat>(`/agent-chat/chats/${id}`, send("PATCH", input)),
  remove: (id: string) => request<void>(`/agent-chat/chats/${id}`, send("DELETE")),
  message: (id: string, input: SendAgentMessage) =>
    request<AgentChat>(`/agent-chat/chats/${id}/messages`, send("POST", input)),
  stop: (id: string) => request<AgentChat>(`/agent-chat/chats/${id}/stop`, send("POST")),
};
