import type {
  ActivityEntry,
  ApplyOperationsRequest,
  ApplyOperationsResult,
  ArchitectureElement,
  ArchitectureModel,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
  CreateRecordInput,
  CreateViewInput,
  CreateWorkspaceInput,
  McpInfo,
  SnapshotSummary,
  UpdateLayoutRequest,
  UpdateRecordInput,
  UpdateViewInput,
  UpdateWorkspaceInput,
  ValidationResult,
  ViewDetail,
  Workspace,
  WorkspaceDocument,
} from "@structsmith/contracts";
import type { ElementPreset } from "@structsmith/domain";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

const TOKEN_KEY = "structsmith.token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null): void => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string; details?: unknown } };
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? "UNKNOWN",
      envelope?.error?.message ?? `Request failed with ${response.status}`,
      envelope?.error?.details,
    );
  }

  return payload as T;
}

const body = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });

export const api = {
  /* workspaces */
  listWorkspaces: () => request<{ workspaces: Workspace[] }>("/workspaces").then((r) => r.workspaces),
  getWorkspace: (id: string) => request<Workspace>(`/workspaces/${id}`),
  createWorkspace: (input: CreateWorkspaceInput) =>
    request<Workspace>("/workspaces", { method: "POST", ...body(input) }),
  updateWorkspace: (id: string, input: UpdateWorkspaceInput) =>
    request<{ result: Workspace; revision: number }>(`/workspaces/${id}`, {
      method: "PATCH",
      ...body(input),
    }),
  deleteWorkspace: (id: string) => request<void>(`/workspaces/${id}`, { method: "DELETE" }),
  importWorkspace: (document: WorkspaceDocument, name?: string) =>
    request<Workspace>("/workspaces/import", {
      method: "POST",
      ...body({ document, mode: "new", name }),
    }),

  /* model */
  getModel: (id: string) => request<ArchitectureModel>(`/workspaces/${id}/model`),
  getDocument: (id: string) => request<WorkspaceDocument>(`/workspaces/${id}/document`),
  validate: (id: string) => request<ValidationResult>(`/workspaces/${id}/validate`),
  getActivity: (id: string) =>
    request<{ activity: ActivityEntry[] }>(`/workspaces/${id}/activity`).then((r) => r.activity),
  exportMermaid: (id: string, viewId?: string) =>
    request<string>(`/workspaces/${id}/export/mermaid${viewId ? `?viewId=${viewId}` : ""}`),
  applyOperations: (id: string, command: ApplyOperationsRequest) =>
    request<ApplyOperationsResult>(`/workspaces/${id}/commands`, { method: "POST", ...body(command) }),

  /* elements & relationships (single-entity REST surface) */
  listElements: (id: string) =>
    request<{ elements: ArchitectureElement[] }>(`/workspaces/${id}/elements`).then((r) => r.elements),
  listRelationships: (id: string) =>
    request<{ relationships: ArchitectureRelationship[] }>(`/workspaces/${id}/relationships`).then(
      (r) => r.relationships,
    ),

  /* views */
  listViews: (id: string) =>
    request<{ views: ViewDetail[] }>(`/workspaces/${id}/views?include=elements`).then((r) => r.views),
  getView: (viewId: string) => request<ViewDetail>(`/views/${viewId}`),
  createView: (id: string, input: CreateViewInput) =>
    request<{ result: ViewDetail; revision: number }>(`/workspaces/${id}/views`, {
      method: "POST",
      ...body(input),
    }),
  updateView: (viewId: string, input: UpdateViewInput) =>
    request<{ result: ViewDetail; revision: number }>(`/views/${viewId}`, {
      method: "PATCH",
      ...body(input),
    }),
  deleteView: (viewId: string) =>
    request<{ result: { id: string }; revision: number }>(`/views/${viewId}`, { method: "DELETE" }),
  saveLayout: (viewId: string, input: UpdateLayoutRequest) =>
    request<{ result: ViewDetail; revision: number }>(`/views/${viewId}/layout`, {
      method: "PATCH",
      ...body(input),
    }),
  setViewElements: (viewId: string, elementIds: string[], mode: "add" | "remove" | "replace") =>
    request<{ result: ViewDetail; revision: number }>(`/views/${viewId}/elements`, {
      method: "POST",
      ...body({ elementIds, mode }),
    }),
  autoLayout: (viewId: string, direction: "LR" | "TB") =>
    request<{ result: ViewDetail; revision: number }>(`/views/${viewId}/auto-layout`, {
      method: "POST",
      ...body({ direction }),
    }),

  /* records */
  listRecords: (id: string) =>
    request<{ records: ArchitectureRecord[] }>(`/workspaces/${id}/records`).then((r) => r.records),
  createRecord: (id: string, input: CreateRecordInput) =>
    request<{ result: ArchitectureRecord; revision: number }>(`/workspaces/${id}/records`, {
      method: "POST",
      ...body(input),
    }),
  updateRecord: (recordId: string, input: UpdateRecordInput) =>
    request<{ result: ArchitectureRecord; revision: number }>(`/records/${recordId}`, {
      method: "PATCH",
      ...body(input),
    }),
  deleteRecord: (recordId: string) =>
    request<{ revision: number }>(`/records/${recordId}`, { method: "DELETE" }),

  /* snapshots */
  listSnapshots: (id: string) =>
    request<{ snapshots: SnapshotSummary[] }>(`/workspaces/${id}/snapshots`).then((r) => r.snapshots),
  createSnapshot: (id: string, label: string) =>
    request<SnapshotSummary>(`/workspaces/${id}/snapshots`, {
      method: "POST",
      ...body({ label, source: "ui" }),
    }),
  restoreSnapshot: (snapshotId: string) =>
    request<{ workspaceId: string; revision: number; snapshotId: string }>(
      `/snapshots/${snapshotId}/restore`,
      { method: "POST" },
    ),

  /* system */
  getMcpInfo: () => request<McpInfo>("/mcp-info"),
  getPresets: () => request<{ presets: ElementPreset[] }>("/presets").then((r) => r.presets),
  getSettings: () =>
    request<{ productName: string; version: string; authMode: "none" | "token"; mcpReadOnly: boolean }>(
      "/settings",
    ),
};
