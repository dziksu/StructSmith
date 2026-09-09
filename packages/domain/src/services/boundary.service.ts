import type {
  ArchitectureBoundary,
  CreateBoundaryInput,
  UpdateBoundaryInput,
} from "@structsmith/contracts";
import { type MutationOptions, mutate, type ServiceContext } from "../context";
import * as engine from "../engine";

export class BoundaryService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): ArchitectureBoundary[] {
    return this.ctx.store.boundaries.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, input: CreateBoundaryInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const boundary = engine.createBoundary(repos, workspace, input);
      return { result: boundary, message: `Added boundary "${boundary.name}"` };
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
      return { result: boundary, message: `Updated boundary "${boundary.name}"` };
    });
  }

  delete(
    workspaceId: string,
    boundaryId: string,
    options: MutationOptions & { cascade?: boolean } = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => ({
      result: engine.deleteBoundary(repos, workspace, boundaryId, options.cascade),
      message: "Deleted boundary",
    }));
  }
}
