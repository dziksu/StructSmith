import type {
  ArchitectureBoundary,
  CreateBoundaryInput,
  UpdateBoundaryInput,
} from "@structsmith/contracts";
import { type MutationOptions, mutate, type ServiceContext } from "../context";
import * as engine from "../engine";

export class BoundaryService {
  constructor(private readonly ctx: ServiceContext) {}

  list(viewId: string): ArchitectureBoundary[] {
    return this.ctx.store.boundaries.listByView(viewId);
  }

  create(workspaceId: string, input: CreateBoundaryInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const boundary = engine.createBoundary(repos, workspace, input);
      return {
        result: boundary,
        message: `Added boundary "${boundary.name}"`,
        kind: "view" as const,
        viewId: boundary.viewId,
      };
    });
  }

  update(
    workspaceId: string,
    boundaryId: string,
    input: UpdateBoundaryInput,
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const boundary = engine.updateBoundary(repos, workspace, boundaryId, input);
      return {
        result: boundary,
        message: `Updated boundary "${boundary.name}"`,
        kind: "view" as const,
        viewId: boundary.viewId,
      };
    });
  }

  delete(
    workspaceId: string,
    boundaryId: string,
    options: MutationOptions & { cascade?: boolean } = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const viewId = repos.boundaries.findById(boundaryId)?.viewId;
      return {
        result: engine.deleteBoundary(repos, workspace, boundaryId, options.cascade),
        message: "Deleted boundary",
        kind: "view" as const,
        viewId,
      };
    });
  }
}
