import type {
  ArchitectureElement,
  CreateElementInput,
  UpdateElementInput,
} from "@structsmith/contracts";
import { type MutationOptions, mutate, type ServiceContext } from "../context";
import * as engine from "../engine";

export class ElementService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): ArchitectureElement[] {
    return this.ctx.store.elements.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, input: CreateElementInput, options: MutationOptions = {}) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const element = engine.createElement(repos, workspace, input);
      return { result: element, message: `Added ${element.kind} "${element.name}"` };
    });
  }

  update(
    workspaceId: string,
    elementId: string,
    input: UpdateElementInput,
    options: MutationOptions = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const element = engine.updateElement(repos, workspace, elementId, input);
      return { result: element, message: `Updated "${element.name}"` };
    });
  }

  delete(
    workspaceId: string,
    elementId: string,
    options: MutationOptions & { cascade?: boolean } = {},
  ) {
    return mutate(this.ctx, workspaceId, options, (repos, workspace) => {
      const name = repos.elements.findById(elementId)?.name ?? elementId;
      const ids = engine.deleteElement(repos, workspace, elementId, options.cascade ?? true);
      return { result: ids, message: `Deleted "${name}" from the model` };
    });
  }
}
