import type {
  ArchitectureRelationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
} from "@structsmith/contracts";
import { type MutationOptions, mutate, type ServiceContext } from "../context";
import * as engine from "../engine";

export class RelationshipService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): ArchitectureRelationship[] {
    return this.ctx.store.relationships.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, input: CreateRelationshipInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const relationship = engine.createRelationship(repos, workspace, input);
      const source = repos.elements.findById(relationship.sourceElementId)?.name ?? "?";
      const target = repos.elements.findById(relationship.targetElementId)?.name ?? "?";
      return { result: relationship, message: `Connected ${source} → ${target}` };
    });
  }

  update(
    workspaceId: string,
    relationshipId: string,
    input: UpdateRelationshipInput,
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const relationship = engine.updateRelationship(repos, workspace, relationshipId, input);
      return { result: relationship, message: "Updated a relationship" };
    });
  }

  delete(workspaceId: string, relationshipId: string, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      engine.deleteRelationship(repos, workspace, relationshipId);
      return { result: { id: relationshipId }, message: "Deleted a relationship" };
    });
  }
}
