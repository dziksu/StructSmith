import type {
  ApplyOperationsResult,
  ArchitectureOperation,
  Workspace,
} from "@structsmith/contracts";
import * as engine from "./engine";
import { badRequest } from "./errors";
import type { Repositories } from "./ports";

type Applied = { op: string; ref?: string; id?: string };

class RefTable {
  private readonly refs = new Map<string, string>();

  set(ref: string | undefined, id: string): void {
    if (ref) this.refs.set(ref, id);
  }

  resolve<T extends string | null | undefined>(value: T): T {
    if (typeof value !== "string" || !value.startsWith("@")) return value;
    const id = this.refs.get(value.slice(1));
    if (!id) throw badRequest(`Unknown reference "${value}" in operation batch.`);
    return id as T;
  }

  resolveAll(values: readonly string[]): string[] {
    return values.map((value) => this.resolve(value));
  }
}

/**
 * Applies a batch of operations. The caller is responsible for wrapping this
 * in a transaction and for the revision guard (see `ModelService`).
 */
export function applyOperations(
  repos: Repositories,
  workspace: Workspace,
  operations: readonly ArchitectureOperation[],
): { applied: Applied[]; warnings: string[] } {
  const refs = new RefTable();
  const applied: Applied[] = [];
  const warnings: string[] = [];

  for (const operation of operations) {
    switch (operation.op) {
      case "createElement": {
        const element = engine.createElement(
          repos,
          workspace,
          { ...operation.data, parentId: refs.resolve(operation.data.parentId) },
          warnings,
        );
        refs.set(operation.ref, element.id);
        applied.push({ op: operation.op, ref: operation.ref, id: element.id });
        break;
      }
      case "updateElement": {
        const element = engine.updateElement(
          repos,
          workspace,
          refs.resolve(operation.elementId),
          { ...operation.data, parentId: refs.resolve(operation.data.parentId) },
          warnings,
        );
        applied.push({ op: operation.op, id: element.id });
        break;
      }
      case "deleteElement": {
        const ids = engine.deleteElement(
          repos,
          workspace,
          refs.resolve(operation.elementId),
          operation.cascade,
        );
        applied.push({ op: operation.op, id: ids[0] });
        break;
      }
      case "createRelationship": {
        const relationship = engine.createRelationship(repos, workspace, {
          ...operation.data,
          sourceElementId: refs.resolve(operation.data.sourceElementId),
          targetElementId: refs.resolve(operation.data.targetElementId),
        });
        refs.set(operation.ref, relationship.id);
        applied.push({ op: operation.op, ref: operation.ref, id: relationship.id });
        break;
      }
      case "updateRelationship": {
        const relationship = engine.updateRelationship(
          repos,
          workspace,
          refs.resolve(operation.relationshipId),
          {
            ...operation.data,
            sourceElementId: refs.resolve(operation.data.sourceElementId),
            targetElementId: refs.resolve(operation.data.targetElementId),
          },
        );
        applied.push({ op: operation.op, id: relationship.id });
        break;
      }
      case "deleteRelationship": {
        const id = refs.resolve(operation.relationshipId);
        engine.deleteRelationship(repos, workspace, id);
        applied.push({ op: operation.op, id });
        break;
      }
      case "createView": {
        const view = engine.createView(repos, workspace, {
          ...operation.data,
          scopeElementId: refs.resolve(operation.data.scopeElementId),
          elementIds: operation.data.elementIds
            ? refs.resolveAll(operation.data.elementIds)
            : undefined,
        });
        refs.set(operation.ref, view.id);
        applied.push({ op: operation.op, ref: operation.ref, id: view.id });
        break;
      }
      case "updateView": {
        const view = engine.updateView(repos, workspace, refs.resolve(operation.viewId), {
          ...operation.data,
          scopeElementId: refs.resolve(operation.data.scopeElementId),
        });
        applied.push({ op: operation.op, id: view.id });
        break;
      }
      case "deleteView": {
        const id = refs.resolve(operation.viewId);
        engine.deleteView(repos, workspace, id);
        applied.push({ op: operation.op, id });
        break;
      }
      case "setViewElements": {
        const viewId = refs.resolve(operation.viewId);
        engine.setViewElements(
          repos,
          workspace,
          viewId,
          refs.resolveAll(operation.elementIds),
          operation.mode,
        );
        applied.push({ op: operation.op, id: viewId });
        break;
      }
      case "setViewRelationships": {
        const viewId = refs.resolve(operation.viewId);
        engine.setViewRelationships(
          repos,
          workspace,
          viewId,
          operation.relationships.map((patch) => ({
            ...patch,
            relationshipId: refs.resolve(patch.relationshipId),
          })),
        );
        applied.push({ op: operation.op, id: viewId });
        break;
      }
      case "setLayout": {
        const viewId = refs.resolve(operation.viewId);
        engine.setLayout(
          repos,
          workspace,
          viewId,
          operation.entries.map((entry) => ({
            ...entry,
            elementId: refs.resolve(entry.elementId),
          })),
        );
        applied.push({ op: operation.op, id: viewId });
        break;
      }
      case "autoLayoutView": {
        const viewId = refs.resolve(operation.viewId);
        engine.autoLayoutView(repos, workspace, viewId, operation.direction);
        applied.push({ op: operation.op, id: viewId });
        break;
      }
      case "createRecord": {
        const record = engine.createRecord(repos, workspace, {
          ...operation.data,
          linkedElementIds: operation.data.linkedElementIds
            ? refs.resolveAll(operation.data.linkedElementIds)
            : undefined,
        });
        refs.set(operation.ref, record.id);
        applied.push({ op: operation.op, ref: operation.ref, id: record.id });
        break;
      }
      case "updateRecord": {
        const record = engine.updateRecord(repos, workspace, refs.resolve(operation.recordId), {
          ...operation.data,
          linkedElementIds: operation.data.linkedElementIds
            ? refs.resolveAll(operation.data.linkedElementIds)
            : undefined,
        });
        applied.push({ op: operation.op, id: record.id });
        break;
      }
      case "deleteRecord": {
        const id = refs.resolve(operation.recordId);
        engine.deleteRecord(repos, workspace, id);
        applied.push({ op: operation.op, id });
        break;
      }
    }
  }

  return { applied, warnings };
}

export type { ApplyOperationsResult };
