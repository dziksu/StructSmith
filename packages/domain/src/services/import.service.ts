import type { Workspace, WorkspaceDocument } from "@structsmith/contracts";
import { requireWorkspace, type ServiceContext } from "../context";
import { createId, nowIso } from "../ids";
import { restoreDocument } from "./snapshot.service";

/** Native JSON import (spec §43). */
export class ImportService {
  constructor(private readonly ctx: ServiceContext) {}

  importDocument(
    document: WorkspaceDocument,
    options: { mode?: "new" | "overwrite"; name?: string } = {},
  ): Workspace {
    const mode = options.mode ?? "new";
    const timestamp = nowIso();

    const workspace = this.ctx.store.transaction((repos) => {
      if (mode === "overwrite") {
        const existing = requireWorkspace(repos, document.workspace.id);
        restoreDocument(repos, document);
        const next: Workspace = {
          ...existing,
          name: options.name ?? document.workspace.name,
          description: document.workspace.description,
          mode: document.workspace.mode,
          revision: existing.revision + 1,
          updatedAt: timestamp,
        };
        repos.workspaces.update(next);
        repos.activity.insert({
          workspaceId: next.id,
          source: "import",
          message: "Imported workspace (overwrite)",
          createdAt: timestamp,
        });
        return next;
      }

      const newId = createId(options.name ?? document.workspace.name);
      const idMap = new Map<string, string>();
      const mapId = (oldId: string): string => {
        const mapped = idMap.get(oldId);
        if (mapped) return mapped;
        const created = createId(oldId);
        idMap.set(oldId, created);
        return created;
      };

      const next: Workspace = {
        id: newId,
        name: options.name ?? document.workspace.name,
        description: document.workspace.description,
        mode: document.workspace.mode,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      repos.workspaces.insert(next);

      const remapped: WorkspaceDocument = {
        formatVersion: 1,
        workspace: next,
        elements: document.elements.map((element) => ({
          ...element,
          id: mapId(element.id),
          workspaceId: newId,
          parentId: element.parentId ? mapId(element.parentId) : null,
        })),
        relationships: document.relationships.map((relationship) => ({
          ...relationship,
          id: mapId(relationship.id),
          workspaceId: newId,
          sourceElementId: mapId(relationship.sourceElementId),
          targetElementId: mapId(relationship.targetElementId),
        })),
        views: document.views.map((view) => {
          const viewId = mapId(view.id);
          return {
            ...view,
            id: viewId,
            workspaceId: newId,
            scopeElementId: view.scopeElementId ? mapId(view.scopeElementId) : null,
            elements: view.elements.map((entry) => ({
              ...entry,
              viewId,
              elementId: mapId(entry.elementId),
            })),
            relationships: view.relationships.map((entry) => ({
              ...entry,
              viewId,
              relationshipId: mapId(entry.relationshipId),
            })),
          };
        }),
        records: document.records.map((record) => ({
          ...record,
          id: mapId(record.id),
          workspaceId: newId,
          linkedElementIds: record.linkedElementIds.map(mapId),
        })),
      };

      restoreDocument(repos, remapped);
      repos.activity.insert({
        workspaceId: newId,
        source: "import",
        message: "Imported workspace",
        createdAt: timestamp,
      });
      return next;
    });

    this.ctx.bus.emit({
      type: "workspace.changed",
      workspaceId: workspace.id,
      revision: workspace.revision,
      source: "import",
      message: "Workspace imported",
    });
    return workspace;
  }
}
