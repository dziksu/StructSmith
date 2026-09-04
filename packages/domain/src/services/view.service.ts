import type {
  ArchitectureView,
  CreateViewInput,
  LayoutDirection,
  LayoutEntry,
  UpdateViewInput,
  ViewDetail,
  ViewRelationshipPatch,
} from "@structsmith/contracts";
import { ERROR_CODES } from "@structsmith/contracts";
import { mutate, requireWorkspace, type MutationOptions, type ServiceContext } from "../context";
import * as engine from "../engine";
import { DomainError } from "../errors";
import type { Repositories } from "../ports";

function readDetail(repos: Repositories, viewId: string): ViewDetail {
  const view = repos.views.findById(viewId);
  if (!view) {
    throw new DomainError(ERROR_CODES.VIEW_NOT_FOUND, `View "${viewId}" does not exist.`, 404);
  }
  return {
    ...view,
    elements: repos.views.listElements(viewId),
    relationships: repos.views.listRelationships(viewId),
  };
}

export class ViewService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): ArchitectureView[] {
    requireWorkspace(this.ctx.store, workspaceId);
    return this.ctx.store.views.listByWorkspace(workspaceId);
  }

  /** Views with their layout rows — lets the UI resolve view membership in one call. */
  listDetailed(workspaceId: string): ViewDetail[] {
    return this.ctx.store.transaction((repos) => {
      requireWorkspace(repos, workspaceId);
      return repos.views
        .listByWorkspace(workspaceId)
        .map((view) => readDetail(repos, view.id));
    });
  }

  get(viewId: string): ViewDetail {
    return this.ctx.store.transaction((repos) => readDetail(repos, viewId));
  }

  create(workspaceId: string, input: CreateViewInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const view = engine.createView(repos, workspace, input);
      return {
        result: readDetail(repos, view.id),
        message: `Created view "${view.name}"`,
        kind: "view" as const,
        viewId: view.id,
      };
    });
  }

  update(workspaceId: string, viewId: string, input: UpdateViewInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const view = engine.updateView(repos, workspace, viewId, input);
      return {
        result: readDetail(repos, view.id),
        message: `Updated view "${view.name}"`,
        kind: "view" as const,
        viewId: view.id,
      };
    });
  }

  delete(workspaceId: string, viewId: string, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const name = repos.views.findById(viewId)?.name ?? viewId;
      engine.deleteView(repos, workspace, viewId);
      return { result: { id: viewId }, message: `Deleted view "${name}"`, kind: "view" as const, viewId };
    });
  }

  setElements(
    workspaceId: string,
    viewId: string,
    elementIds: readonly string[],
    mode: "replace" | "add" | "remove" = "add",
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      engine.setViewElements(repos, workspace, viewId, elementIds, mode);
      return {
        result: readDetail(repos, viewId),
        message: `Updated the contents of a view`,
        kind: "view" as const,
        viewId,
      };
    });
  }

  /** Batch layout write — called after a drag gesture settles (spec §18). */
  saveLayout(
    workspaceId: string,
    viewId: string,
    entries: readonly LayoutEntry[],
    relationships: readonly ViewRelationshipPatch[] = [],
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      if (entries.length > 0) engine.setLayout(repos, workspace, viewId, entries);
      if (relationships.length > 0) {
        engine.setViewRelationships(repos, workspace, viewId, relationships);
      }
      return {
        result: readDetail(repos, viewId),
        message: "Updated diagram layout",
        kind: "view" as const,
        viewId,
      };
    });
  }

  autoLayout(
    workspaceId: string,
    viewId: string,
    direction: LayoutDirection = "LR",
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      engine.autoLayoutView(repos, workspace, viewId, direction);
      return {
        result: readDetail(repos, viewId),
        message: `Auto-arranged the diagram (${direction})`,
        kind: "view" as const,
        viewId,
      };
    });
  }
}
