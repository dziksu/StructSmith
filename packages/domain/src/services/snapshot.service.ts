import type {
  ArchitectureElement,
  ChangeSource,
  SnapshotSummary,
  WorkspaceDocument,
} from "@structsmith/contracts";
import { ERROR_CODES } from "@structsmith/contracts";
import { captureDocument, requireWorkspace, type ServiceContext } from "../context";
import { DomainError } from "../errors";
import { createId, nowIso } from "../ids";
import type { Repositories, StoredSnapshot } from "../ports";

/** Parents must be inserted before their children (foreign keys). */
function inParentOrder(elements: readonly ArchitectureElement[]): ArchitectureElement[] {
  const remaining = [...elements];
  const inserted = new Set<string>();
  const ordered: ArchitectureElement[] = [];

  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const element = remaining[index];
      if (!element) continue;
      if (!element.parentId || inserted.has(element.parentId)) {
        ordered.push(element);
        inserted.add(element.id);
        remaining.splice(index, 1);
        progress = true;
      }
    }
  }
  // Anything left is part of a broken cycle — insert it without a parent.
  for (const element of remaining) ordered.push({ ...element, parentId: null });
  return ordered;
}

export function writeSnapshot(
  repos: Repositories,
  workspaceId: string,
  label: string,
  source: ChangeSource,
  maxSnapshots: number,
): SnapshotSummary {
  const workspace = requireWorkspace(repos, workspaceId);
  const snapshot: StoredSnapshot = {
    id: createId("snap"),
    workspaceId,
    revision: workspace.revision,
    label,
    source,
    createdAt: nowIso(),
    document: captureDocument(repos, workspaceId),
  };
  repos.snapshots.insert(snapshot);
  repos.snapshots.trim(workspaceId, maxSnapshots);
  const { document: _document, ...summary } = snapshot;
  return summary;
}

export function restoreDocument(repos: Repositories, document: WorkspaceDocument): void {
  const workspaceId = document.workspace.id;

  for (const record of repos.records.listByWorkspace(workspaceId)) repos.records.delete(record.id);
  for (const view of repos.views.listByWorkspace(workspaceId)) repos.views.delete(view.id);
  for (const relationship of repos.relationships.listByWorkspace(workspaceId)) {
    repos.relationships.delete(relationship.id);
  }
  for (const element of repos.elements.listByWorkspace(workspaceId)) {
    repos.elements.update({ ...element, parentId: null });
  }
  for (const element of repos.elements.listByWorkspace(workspaceId)) {
    repos.elements.delete(element.id);
  }

  for (const element of inParentOrder(document.elements)) repos.elements.insert(element);
  for (const relationship of document.relationships) repos.relationships.insert(relationship);
  for (const view of document.views) {
    const { elements, relationships, ...rest } = view;
    repos.views.insert(rest);
    for (const entry of elements) repos.views.upsertElement(entry);
    for (const entry of relationships) repos.views.upsertRelationship(entry);
  }
  for (const record of document.records) repos.records.insert(record);
}

export class SnapshotService {
  constructor(private readonly ctx: ServiceContext) {}

  list(workspaceId: string): SnapshotSummary[] {
    requireWorkspace(this.ctx.store, workspaceId);
    return this.ctx.store.snapshots.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, label: string, source: ChangeSource = "ui"): SnapshotSummary {
    return this.ctx.store.transaction((repos) =>
      writeSnapshot(repos, workspaceId, label, source, this.ctx.config.maxSnapshots),
    );
  }

  restore(
    snapshotId: string,
    source: ChangeSource = "ui",
  ): { workspaceId: string; revision: number; snapshotId: string } {
    const outcome = this.ctx.store.transaction((repos) => {
      const snapshot = repos.snapshots.findById(snapshotId);
      if (!snapshot) {
        throw new DomainError(
          ERROR_CODES.SNAPSHOT_NOT_FOUND,
          `Snapshot "${snapshotId}" does not exist.`,
          404,
        );
      }
      const workspace = requireWorkspace(repos, snapshot.workspaceId);

      const undoPoint = writeSnapshot(
        repos,
        workspace.id,
        `Before restoring "${snapshot.label}"`,
        "system",
        this.ctx.config.maxSnapshots,
      );

      restoreDocument(repos, snapshot.document);

      const revision = workspace.revision + 1;
      const updatedAt = nowIso();
      repos.workspaces.update({
        ...workspace,
        name: snapshot.document.workspace.name,
        description: snapshot.document.workspace.description,
        mode: snapshot.document.workspace.mode,
        revision,
        updatedAt,
      });
      repos.activity.insert({
        workspaceId: workspace.id,
        source,
        message: `Restored snapshot "${snapshot.label}"`,
        createdAt: updatedAt,
      });
      return { workspaceId: workspace.id, revision, snapshotId: undoPoint.id };
    });

    this.ctx.bus.emit({
      type: "model.changed",
      workspaceId: outcome.workspaceId,
      revision: outcome.revision,
      source,
      message: "Snapshot restored",
    });
    this.ctx.bus.emit({
      type: "workspace.changed",
      workspaceId: outcome.workspaceId,
      revision: outcome.revision,
      source,
      message: "Snapshot restored",
    });
    return outcome;
  }
}
