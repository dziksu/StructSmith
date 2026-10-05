import { z } from "zod";
import { ReferenceTargetKindSchema } from "./reference";

export const AgentProviderSchema = z.enum(["codex", "claude", "copilot"]);
export type AgentProvider = z.infer<typeof AgentProviderSchema>;
export const AgentModeSchema = z.enum(["ask", "edit"]);
export const ChatContextSchema = z.object({
  type: ReferenceTargetKindSchema,
  targetId: z.string().min(1).max(200),
  label: z.string().max(500).optional(),
  viewId: z.string().max(200).optional(),
});
export type ChatContext = z.infer<typeof ChatContextSchema>;
export const CodexReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);
export type CodexReasoningEffort = z.infer<typeof CodexReasoningEffortSchema>;
export const CodexModelSchema = z.object({
  id: z.string(),
  reasoningEfforts: z.array(CodexReasoningEffortSchema).min(1),
});
export type CodexModel = z.infer<typeof CodexModelSchema>;
const ProviderSettingsSchema = z.object({
  executable: z.string().trim().min(1).max(2000),
  model: z.string().trim().max(200).default(""),
});
export const AgentSettingsSchema = z.object({
  defaultProvider: AgentProviderSchema.default("codex"),
  providers: z.object({
    codex: ProviderSettingsSchema.extend({
      reasoningEffort: z
        .union([z.literal("default"), CodexReasoningEffortSchema])
        .default("default"),
    }),
    claude: ProviderSettingsSchema,
    copilot: ProviderSettingsSchema,
  }),
});
export type AgentSettings = z.infer<typeof AgentSettingsSchema>;
export const defaultAgentSettings: AgentSettings = {
  defaultProvider: "codex",
  providers: {
    codex: { executable: "codex", model: "", reasoningEffort: "default" },
    claude: { executable: "claude", model: "" },
    copilot: { executable: "copilot", model: "" },
  },
};
export const CreateAgentChatSchema = z.object({
  workspaceId: z.string().min(1).max(200).nullable().default(null),
  provider: AgentProviderSchema.optional(),
  directory: z.string().trim().max(2000).default(""),
  context: ChatContextSchema.optional(),
});
export type CreateAgentChat = z.input<typeof CreateAgentChatSchema>;
export const UpdateAgentChatSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  archived: z.boolean().optional(),
  provider: AgentProviderSchema.optional(),
  mode: AgentModeSchema.optional(),
  directory: z.string().trim().max(2000).optional(),
});
export type UpdateAgentChat = z.infer<typeof UpdateAgentChatSchema>;
export const SendAgentMessageSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  context: ChatContextSchema.optional(),
});
export type SendAgentMessage = z.infer<typeof SendAgentMessageSchema>;
export const AgentMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  provider: AgentProviderSchema,
  context: ChatContextSchema.optional(),
  status: z.enum(["running", "complete", "failed", "cancelled"]),
  error: z.string().optional(),
  progress: z.string().optional(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export const AgentChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  archived: z.boolean().default(false),
  workspaceId: z.string().nullable(),
  workspaceName: z.string().nullable(),
  provider: AgentProviderSchema,
  mode: AgentModeSchema,
  directory: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(AgentMessageSchema),
});
export type AgentChat = z.infer<typeof AgentChatSchema>;
export type AgentChatSummary = Omit<AgentChat, "messages"> & { running: boolean };
export interface AgentAvailability {
  provider: AgentProvider;
  available: boolean;
  executable: string;
}
export interface AgentSettingsResponse {
  settings: AgentSettings;
  availability: AgentAvailability[];
  readOnly: boolean;
  codexModels: CodexModel[];
}
