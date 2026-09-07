import type {
  ApplyOperationsResult,
  ArchitectureModel,
  ArchitectureOperation,
  ChangeSource,
  PreviewOperationsResult,
  ValidationResult,
  WorkspaceDocument,
} from "@structsmith/contracts";
import { assertRevision, captureDocument, requireWorkspace, type ServiceContext } from "../context";
import { toMermaid, toOutline } from "../export";
import { nowIso } from "../ids";
import { applyOperations } from "../operations";
import { validateDocument } from "../validation";
import { writeSnapshot } from "./snapshot.service";

export interface ApplyOperationsCommand {
  expectedRevision?: number;
  label?: string;
  operations: readonly ArchitectureOperation[];
}

class PreviewComplete extends Error {
  constructor(readonly result: PreviewOperationsResult) {
    super("Model operation preview complete");
  }
}

export class ModelService {
  constructor(private readonly ctx: ServiceContext) {}

  get(workspaceId: string): ArchitectureModel {
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

  validate(workspaceId: string): ValidationResult {
    return validateDocument(this.getDocument(workspaceId));
  }

  exportMermaid(workspaceId: string, viewId?: string): string {
    const document = this.getDocument(workspaceId);
    const view = viewId ? document.views.find((candidate) => candidate.id === viewId) : undefined;
    return toMermaid(document, {
      view,
      direction: view?.settings.autoLayoutDirection ?? "LR",
    });
  }

  exportOutline(workspaceId: string): string {
    return toOutline(this.getDocument(workspaceId));
  }

  /**
   * Runs the real operation engine and validator, then deliberately rolls the
   * transaction back. Generated ids are illustrative and change on apply.
   */
  previewOperations(workspaceId: string, command: ApplyOperationsCommand): PreviewOperationsResult {
    try {
      this.ctx.store.transaction((repos) => {
        const workspace = requireWorkspace(repos, workspaceId);
        assertRevision(workspace, command.expectedRevision);
        const { applied, warnings } = applyOperations(repos, workspace, command.operations);
        const validation = validateDocument(captureDocument(repos, workspaceId));

        throw new PreviewComplete({
          success: true,
          baseRevision: workspace.revision,
          predictedRevision: workspace.revision + 1,
          appliedOperations: applied,
          warnings,
          validation,
          persisted: false,
          note: "Preview only. Generated ids are not reserved and will differ when applied.",
        });
      });
    } catch (error) {
      if (error instanceof PreviewComplete) return error.result;
      throw error;
    }

    throw new Error("Operation preview did not complete.");
  }

  /**
   * The most important write path (spec §22): a whole logical change lands in
   * one SQLite transaction, guarded by the workspace revision and preceded by
   * an automatic snapshot.
   */
  applyOperations(
    workspaceId: string,
    command: ApplyOperationsCommand,
    source: ChangeSource = "ui",
  ): ApplyOperationsResult {
    const outcome = this.ctx.store.transaction((repos) => {
      const workspace = requireWorkspace(repos, workspaceId);
      assertRevision(workspace, command.expectedRevision);

      const label = command.label ?? `Before ${source.toUpperCase()} change`;
      const snapshot = writeSnapshot(
        repos,
        workspaceId,
        label,
        source,
        this.ctx.config.maxSnapshots,
      );

      const { applied, warnings } = applyOperations(repos, workspace, command.operations);

      const revision = workspace.revision + 1;
      const updatedAt = nowIso();
      const current = repos.workspaces.findById(workspaceId) ?? workspace;
      repos.workspaces.update({ ...current, revision, updatedAt });
      repos.activity.insert({
        workspaceId,
        source,
        message:
          command.label ??
          `${source === "mcp" ? "MCP" : "Batch"} change: ${command.operations.length} operation(s)`,
        createdAt: updatedAt,
      });
      repos.activity.trim(workspaceId, this.ctx.config.maxActivityEntries);

      return {
        success: true,
        previousRevision: workspace.revision,
        revision,
        appliedOperations: applied,
        warnings,
        snapshotId: snapshot.id,
      } satisfies ApplyOperationsResult;
    });

    this.ctx.bus.emit({
      type: "model.changed",
      workspaceId,
      revision: outcome.revision,
      source,
      message: command.label,
    });
    this.ctx.bus.emit({
      type: "workspace.changed",
      workspaceId,
      revision: outcome.revision,
      source,
      message: command.label,
    });

    return outcome;
  }
}
