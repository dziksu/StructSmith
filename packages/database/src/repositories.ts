import type {
  ActivityEntry,
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
  SnapshotSummary,
  ViewElement,
  ViewRelationship,
  Workspace,
  WorkspaceDocument,
} from "@structsmith/contracts";
import type {
  ActivityRepository,
  ElementRepository,
  RecordRepository,
  RelationshipRepository,
  Repositories,
  SnapshotRepository,
  StoredSnapshot,
  ViewRepository,
  WorkspaceRepository,
} from "@structsmith/domain";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  fromElement,
  fromRecord,
  fromRelationship,
  fromView,
  fromViewElement,
  fromViewRelationship,
  fromWorkspace,
  toActivity,
  toElement,
  toRecord,
  toRelationship,
  toView,
  toViewElement,
  toViewRelationship,
  toWorkspace,
} from "./mappers";
import * as t from "./schema";

type TxLike = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | TxLike;

/* ------------------------------------------------------------------ */

function workspaceRepository(db: Executor): WorkspaceRepository {
  return {
    list: () =>
      db.select().from(t.workspaces).orderBy(desc(t.workspaces.updatedAt)).all().map(toWorkspace),
    findById: (id) => {
      const row = db.select().from(t.workspaces).where(eq(t.workspaces.id, id)).get();
      return row ? toWorkspace(row) : undefined;
    },
    insert: (workspace: Workspace) => {
      db.insert(t.workspaces).values(fromWorkspace(workspace)).run();
    },
    update: (workspace: Workspace) => {
      db.update(t.workspaces)
        .set(fromWorkspace(workspace))
        .where(eq(t.workspaces.id, workspace.id))
        .run();
    },
    delete: (id) => {
      db.delete(t.workspaces).where(eq(t.workspaces.id, id)).run();
    },
  };
}

function elementRepository(db: Executor): ElementRepository {
  return {
    listByWorkspace: (workspaceId) =>
      db
        .select()
        .from(t.elements)
        .where(eq(t.elements.workspaceId, workspaceId))
        .orderBy(asc(t.elements.createdAt), asc(t.elements.id))
        .all()
        .map(toElement),
    findById: (id) => {
      const row = db.select().from(t.elements).where(eq(t.elements.id, id)).get();
      return row ? toElement(row) : undefined;
    },
    insert: (element: ArchitectureElement) => {
      db.insert(t.elements).values(fromElement(element)).run();
    },
    update: (element: ArchitectureElement) => {
      db.update(t.elements).set(fromElement(element)).where(eq(t.elements.id, element.id)).run();
    },
    delete: (id) => {
      db.delete(t.elements).where(eq(t.elements.id, id)).run();
    },
  };
}

function relationshipRepository(db: Executor): RelationshipRepository {
  return {
    listByWorkspace: (workspaceId) =>
      db
        .select()
        .from(t.relationships)
        .where(eq(t.relationships.workspaceId, workspaceId))
        .orderBy(asc(t.relationships.createdAt), asc(t.relationships.id))
        .all()
        .map(toRelationship),
    findById: (id) => {
      const row = db.select().from(t.relationships).where(eq(t.relationships.id, id)).get();
      return row ? toRelationship(row) : undefined;
    },
    insert: (relationship: ArchitectureRelationship) => {
      db.insert(t.relationships).values(fromRelationship(relationship)).run();
    },
    update: (relationship: ArchitectureRelationship) => {
      db.update(t.relationships)
        .set(fromRelationship(relationship))
        .where(eq(t.relationships.id, relationship.id))
        .run();
    },
    delete: (id) => {
      db.delete(t.relationships).where(eq(t.relationships.id, id)).run();
    },
    deleteByElement: (elementId) => {
      const rows = db
        .select({ id: t.relationships.id })
        .from(t.relationships)
        .where(
          or(
            eq(t.relationships.sourceElementId, elementId),
            eq(t.relationships.targetElementId, elementId),
          ),
        )
        .all();
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        db.delete(t.relationships).where(inArray(t.relationships.id, ids)).run();
      }
      return ids;
    },
  };
}

function viewRepository(db: Executor): ViewRepository {
  return {
    listByWorkspace: (workspaceId) =>
      db
        .select()
        .from(t.views)
        .where(eq(t.views.workspaceId, workspaceId))
        .orderBy(asc(t.views.createdAt), asc(t.views.id))
        .all()
        .map(toView),
    findById: (id) => {
      const row = db.select().from(t.views).where(eq(t.views.id, id)).get();
      return row ? toView(row) : undefined;
    },
    insert: (view: ArchitectureView) => {
      db.insert(t.views).values(fromView(view)).run();
    },
    update: (view: ArchitectureView) => {
      db.update(t.views).set(fromView(view)).where(eq(t.views.id, view.id)).run();
    },
    delete: (id) => {
      db.delete(t.views).where(eq(t.views.id, id)).run();
    },

    listElements: (viewId) =>
      db
        .select()
        .from(t.viewElements)
        .where(eq(t.viewElements.viewId, viewId))
        .all()
        .map(toViewElement),
    listElementsByWorkspace: (workspaceId) =>
      db
        .select({ entry: t.viewElements })
        .from(t.viewElements)
        .innerJoin(t.views, eq(t.views.id, t.viewElements.viewId))
        .where(eq(t.views.workspaceId, workspaceId))
        .all()
        .map((row) => toViewElement(row.entry)),
    upsertElement: (entry: ViewElement) => {
      db.insert(t.viewElements)
        .values(fromViewElement(entry))
        .onConflictDoUpdate({
          target: [t.viewElements.viewId, t.viewElements.elementId],
          set: fromViewElement(entry),
        })
        .run();
    },
    removeElement: (viewId, elementId) => {
      db.delete(t.viewElements)
        .where(and(eq(t.viewElements.viewId, viewId), eq(t.viewElements.elementId, elementId)))
        .run();
    },
    removeElementEverywhere: (elementId) => {
      db.delete(t.viewElements).where(eq(t.viewElements.elementId, elementId)).run();
    },

    listRelationships: (viewId) =>
      db
        .select()
        .from(t.viewRelationships)
        .where(eq(t.viewRelationships.viewId, viewId))
        .all()
        .map(toViewRelationship),
    upsertRelationship: (entry: ViewRelationship) => {
      db.insert(t.viewRelationships)
        .values(fromViewRelationship(entry))
        .onConflictDoUpdate({
          target: [t.viewRelationships.viewId, t.viewRelationships.relationshipId],
          set: fromViewRelationship(entry),
        })
        .run();
    },
    removeRelationship: (viewId, relationshipId) => {
      db.delete(t.viewRelationships)
        .where(
          and(
            eq(t.viewRelationships.viewId, viewId),
            eq(t.viewRelationships.relationshipId, relationshipId),
          ),
        )
        .run();
    },
    removeRelationshipEverywhere: (relationshipId) => {
      db.delete(t.viewRelationships)
        .where(eq(t.viewRelationships.relationshipId, relationshipId))
        .run();
    },
  };
}

function recordRepository(db: Executor): RecordRepository {
  const linksFor = (recordIds: string[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    if (recordIds.length === 0) return map;
    const rows = db
      .select()
      .from(t.recordLinks)
      .where(inArray(t.recordLinks.recordId, recordIds))
      .all();
    for (const row of rows) {
      const bucket = map.get(row.recordId);
      if (bucket) bucket.push(row.elementId);
      else map.set(row.recordId, [row.elementId]);
    }
    return map;
  };

  const writeLinks = (record: ArchitectureRecord): void => {
    db.delete(t.recordLinks).where(eq(t.recordLinks.recordId, record.id)).run();
    for (const elementId of record.linkedElementIds) {
      db.insert(t.recordLinks).values({ recordId: record.id, elementId }).run();
    }
  };

  return {
    listByWorkspace: (workspaceId) => {
      const rows = db
        .select()
        .from(t.records)
        .where(eq(t.records.workspaceId, workspaceId))
        .orderBy(asc(t.records.createdAt), asc(t.records.id))
        .all();
      const links = linksFor(rows.map((row) => row.id));
      return rows.map((row) => toRecord(row, links.get(row.id) ?? []));
    },
    findById: (id) => {
      const row = db.select().from(t.records).where(eq(t.records.id, id)).get();
      if (!row) return undefined;
      return toRecord(row, linksFor([id]).get(id) ?? []);
    },
    insert: (record: ArchitectureRecord) => {
      db.insert(t.records).values(fromRecord(record)).run();
      writeLinks(record);
    },
    update: (record: ArchitectureRecord) => {
      db.update(t.records).set(fromRecord(record)).where(eq(t.records.id, record.id)).run();
      writeLinks(record);
    },
    delete: (id) => {
      db.delete(t.records).where(eq(t.records.id, id)).run();
    },
    removeElementLinks: (elementId) => {
      db.delete(t.recordLinks).where(eq(t.recordLinks.elementId, elementId)).run();
    },
  };
}

function snapshotRepository(db: Executor): SnapshotRepository {
  return {
    listByWorkspace: (workspaceId): SnapshotSummary[] =>
      db
        .select({
          id: t.snapshots.id,
          workspaceId: t.snapshots.workspaceId,
          revision: t.snapshots.revision,
          label: t.snapshots.label,
          source: t.snapshots.source,
          createdAt: t.snapshots.createdAt,
        })
        .from(t.snapshots)
        .where(eq(t.snapshots.workspaceId, workspaceId))
        .orderBy(desc(t.snapshots.createdAt), desc(t.snapshots.id))
        .all()
        .map((row) => ({ ...row, source: row.source as SnapshotSummary["source"] })),
    findById: (id) => {
      const row = db.select().from(t.snapshots).where(eq(t.snapshots.id, id)).get();
      if (!row) return undefined;
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        revision: row.revision,
        label: row.label,
        source: row.source as SnapshotSummary["source"],
        createdAt: row.createdAt,
        document: JSON.parse(row.snapshotJson) as WorkspaceDocument,
      };
    },
    insert: (snapshot: StoredSnapshot) => {
      db.insert(t.snapshots)
        .values({
          id: snapshot.id,
          workspaceId: snapshot.workspaceId,
          revision: snapshot.revision,
          label: snapshot.label,
          source: snapshot.source,
          snapshotJson: JSON.stringify(snapshot.document),
          createdAt: snapshot.createdAt,
        })
        .run();
    },
    trim: (workspaceId, keep) => {
      const rows = db
        .select({ id: t.snapshots.id })
        .from(t.snapshots)
        .where(eq(t.snapshots.workspaceId, workspaceId))
        .orderBy(desc(t.snapshots.createdAt), desc(t.snapshots.id))
        .all();
      const stale = rows.slice(keep).map((row) => row.id);
      if (stale.length > 0) {
        db.delete(t.snapshots).where(inArray(t.snapshots.id, stale)).run();
      }
    },
  };
}

function activityRepository(db: Executor): ActivityRepository {
  return {
    listByWorkspace: (workspaceId, limit): ActivityEntry[] =>
      db
        .select()
        .from(t.activity)
        .where(eq(t.activity.workspaceId, workspaceId))
        .orderBy(desc(t.activity.id))
        .limit(limit)
        .all()
        .map(toActivity),
    insert: (entry) => {
      db.insert(t.activity).values(entry).run();
    },
    trim: (workspaceId, keep) => {
      const cutoff = db
        .select({ id: t.activity.id })
        .from(t.activity)
        .where(eq(t.activity.workspaceId, workspaceId))
        .orderBy(desc(t.activity.id))
        .limit(1)
        .offset(keep)
        .get();
      if (cutoff) {
        db.delete(t.activity)
          .where(and(eq(t.activity.workspaceId, workspaceId), lt(t.activity.id, cutoff.id + 1)))
          .run();
      }
    },
  };
}

export function createRepositories(db: Executor): Repositories {
  return {
    workspaces: workspaceRepository(db),
    elements: elementRepository(db),
    relationships: relationshipRepository(db),
    views: viewRepository(db),
    records: recordRepository(db),
    snapshots: snapshotRepository(db),
    activity: activityRepository(db),
  };
}

export const rawSql = sql;
