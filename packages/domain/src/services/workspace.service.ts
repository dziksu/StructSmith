import type {
  ArchitectureModel,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceDocument,
} from "@structsmith/contracts";
import {
  captureDocument,
  type MutationOptions,
  mutate,
  requireWorkspace,
  type ServiceContext,
} from "../context";
import { createId, nowIso } from "../ids";

export class WorkspaceService {
  constructor(private readonly ctx: ServiceContext) {}

  list(): Workspace[] {
    return this.ctx.store.workspaces.list();
  }

  get(workspaceId: string): Workspace {
    return requireWorkspace(this.ctx.store, workspaceId);
  }

  create(input: CreateWorkspaceInput): Workspace {
    const timestamp = nowIso();
    const workspace: Workspace = {
      id: input.id ?? createId(input.name),
      name: input.name,
      description: input.description ?? null,
      mode: input.mode ?? "relaxed",
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.ctx.store.transaction((repos) => {
      repos.workspaces.insert(workspace);
      repos.activity.insert({
        workspaceId: workspace.id,
        source: "ui",
        message: `Created workspace "${workspace.name}"`,
        createdAt: timestamp,
      });
    });
    this.ctx.bus.emit({
      type: "workspace.changed",
      workspaceId: workspace.id,
      revision: workspace.revision,
      source: "ui",
      message: "Workspace created",
    });
    return workspace;
  }

  update(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    options: MutationOptions = {},
  ): { result: Workspace; revision: number } {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const next: Workspace = {
        ...workspace,
        name: input.name ?? workspace.name,
        description:
          input.description !== undefined ? (input.description ?? null) : workspace.description,
        mode: input.mode ?? workspace.mode,
        updatedAt: nowIso(),
      };
      repos.workspaces.update(next);
      return { result: next, message: `Updated workspace settings`, kind: "workspace" };
    });
  }

  delete(workspaceId: string): void {
    this.ctx.store.transaction((repos) => {
      requireWorkspace(repos, workspaceId);
      repos.workspaces.delete(workspaceId);
    });
    this.ctx.bus.emit({ type: "workspace.deleted", workspaceId, source: "ui" });
  }

  getModel(workspaceId: string): ArchitectureModel {
    return this.ctx.store.transaction((repos) => {
      const workspace = requireWorkspace(repos, workspaceId);
      return {
        workspace,
        elements: repos.elements.listByWorkspace(workspaceId),
        relationships: repos.relationships.listByWorkspace(workspaceId),
        revision: workspace.revision,
      };
    });
  }

  getDocument(workspaceId: string): WorkspaceDocument {
    return this.ctx.store.transaction((repos) => captureDocument(repos, workspaceId));
  }
}
