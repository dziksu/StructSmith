import type { ChangeSource, Workspace, WorkspaceDocument } from "@structsmith/contracts";
import { ERROR_CODES } from "@structsmith/contracts";
import { conflict, DomainError } from "./errors";
import { nowIso } from "./ids";
import type { EventBus, Repositories, Store } from "./ports";

export interface DomainConfig {
  /** Snapshots kept per workspace (spec §16). */
  maxSnapshots: number;
  /** Activity entries kept per workspace. */
  maxActivityEntries: number;
}

export const defaultDomainConfig: DomainConfig = {
  maxSnapshots: 30,
  maxActivityEntries: 500,
};

export interface ServiceContext {
  store: Store;
  bus: EventBus;
  config: DomainConfig;
}

export interface MutationOptions {
  expectedRevision?: number;
  source?: ChangeSource;
}

export type ChangeKind = "workspace" | "model" | "view" | "record";

export interface MutationOutcome<T> {
  result: T;
  message: string;
  kind?: ChangeKind;
  viewId?: string;
}

export interface MutationResult<T> {
  result: T;
  revision: number;
}

export function requireWorkspace(repos: Repositories, workspaceId: string): Workspace {
  const workspace = repos.workspaces.findById(workspaceId);
  if (!workspace) {
    throw new DomainError(
      ERROR_CODES.WORKSPACE_NOT_FOUND,
      `Workspace "${workspaceId}" does not exist.`,
      404,
    );
  }
  return workspace;
}

export function assertRevision(workspace: Workspace, expected: number | undefined): void {
  if (expected !== undefined && expected !== workspace.revision) {
    throw conflict(
      `Workspace was modified by someone else (expected revision ${expected}, current ${workspace.revision}).`,
      { expectedRevision: expected, currentRevision: workspace.revision },
    );
  }
}

/** Read the complete portable document of a workspace. */
export function captureDocument(repos: Repositories, workspaceId: string): WorkspaceDocument {
  const workspace = requireWorkspace(repos, workspaceId);
  const views = repos.views.listByWorkspace(workspaceId).map((view) => ({
    ...view,
    elements: repos.views.listElements(view.id),
    relationships: repos.views.listRelationships(view.id),
  }));
  return {
    formatVersion: 1,
    workspace,
    elements: repos.elements.listByWorkspace(workspaceId),
    relationships: repos.relationships.listByWorkspace(workspaceId),
    views,
    records: repos.records.listByWorkspace(workspaceId),
  };
}

/**
 * Runs a mutation inside a single transaction: revision guard, the change
 * itself, revision bump and the activity log. Domain events are emitted only
 * once the transaction committed.
 */
export function mutate<T>(
  ctx: ServiceContext,
  workspaceId: string,
  options: MutationOptions,
  fn: (repos: Repositories, workspace: Workspace) => MutationOutcome<T>,
): MutationResult<T> {
  const source: ChangeSource = options.source ?? "ui";

  const committed = ctx.store.transaction((repos) => {
    const workspace = requireWorkspace(repos, workspaceId);
    assertRevision(workspace, options.expectedRevision);

    const outcome = fn(repos, workspace);

    const revision = workspace.revision + 1;
    const updatedAt = nowIso();
    const current = repos.workspaces.findById(workspaceId) ?? workspace;
    repos.workspaces.update({ ...current, revision, updatedAt });
    repos.activity.insert({ workspaceId, source, message: outcome.message, createdAt: updatedAt });
    repos.activity.trim(workspaceId, ctx.config.maxActivityEntries);

    return { outcome, revision };
  });

  const { outcome, revision } = committed;
  const kind = outcome.kind ?? "model";

  if (kind === "view" && outcome.viewId) {
    ctx.bus.emit({ type: "view.changed", workspaceId, viewId: outcome.viewId, revision, source });
  } else if (kind === "record") {
    ctx.bus.emit({ type: "record.changed", workspaceId, revision, source });
  } else if (kind === "model") {
    ctx.bus.emit({ type: "model.changed", workspaceId, revision, source, message: outcome.message });
  }
  ctx.bus.emit({
    type: "workspace.changed",
    workspaceId,
    revision,
    source,
    message: outcome.message,
  });

  return { result: outcome.result, revision };
}
