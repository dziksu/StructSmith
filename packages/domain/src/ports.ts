import type {
  ActivityEntry,
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
  ChangeSource,
  SnapshotSummary,
  ViewElement,
  ViewRelationship,
  Workspace,
  WorkspaceDocument,
} from "@structsmith/contracts";

export interface WorkspaceRepository {
  list(): Workspace[];
  findById(id: string): Workspace | undefined;
  insert(workspace: Workspace): void;
  update(workspace: Workspace): void;
  delete(id: string): void;
}

export interface ElementRepository {
  listByWorkspace(workspaceId: string): ArchitectureElement[];
  findById(id: string): ArchitectureElement | undefined;
  insert(element: ArchitectureElement): void;
  update(element: ArchitectureElement): void;
  delete(id: string): void;
}

export interface RelationshipRepository {
  listByWorkspace(workspaceId: string): ArchitectureRelationship[];
  findById(id: string): ArchitectureRelationship | undefined;
  insert(relationship: ArchitectureRelationship): void;
  update(relationship: ArchitectureRelationship): void;
  delete(id: string): void;
  deleteByElement(elementId: string): string[];
}

export interface ViewRepository {
  listByWorkspace(workspaceId: string): ArchitectureView[];
  findById(id: string): ArchitectureView | undefined;
  insert(view: ArchitectureView): void;
  update(view: ArchitectureView): void;
  delete(id: string): void;

  listElements(viewId: string): ViewElement[];
  listElementsByWorkspace(workspaceId: string): ViewElement[];
  upsertElement(entry: ViewElement): void;
  removeElement(viewId: string, elementId: string): void;
  removeElementEverywhere(elementId: string): void;

  listRelationships(viewId: string): ViewRelationship[];
  upsertRelationship(entry: ViewRelationship): void;
  removeRelationship(viewId: string, relationshipId: string): void;
  removeRelationshipEverywhere(relationshipId: string): void;
}

export interface RecordRepository {
  listByWorkspace(workspaceId: string): ArchitectureRecord[];
  findById(id: string): ArchitectureRecord | undefined;
  insert(record: ArchitectureRecord): void;
  update(record: ArchitectureRecord): void;
  delete(id: string): void;
  removeElementLinks(elementId: string): void;
}

export interface StoredSnapshot extends SnapshotSummary {
  document: WorkspaceDocument;
}

export interface SnapshotRepository {
  listByWorkspace(workspaceId: string): SnapshotSummary[];
  findById(id: string): StoredSnapshot | undefined;
  insert(snapshot: StoredSnapshot): void;
  trim(workspaceId: string, keep: number): void;
}

export interface ActivityRepository {
  listByWorkspace(workspaceId: string, limit: number): ActivityEntry[];
  insert(entry: {
    workspaceId: string;
    source: ChangeSource;
    message: string;
    createdAt: string;
  }): void;
  trim(workspaceId: string, keep: number): void;
}

export interface Repositories {
  workspaces: WorkspaceRepository;
  elements: ElementRepository;
  relationships: RelationshipRepository;
  views: ViewRepository;
  records: RecordRepository;
  snapshots: SnapshotRepository;
  activity: ActivityRepository;
}

/** Unit of work: everything the domain needs from persistence. */
export interface Store extends Repositories {
  transaction<T>(fn: (repos: Repositories) => T): T;
}

export type DomainEvent =
  | {
      type: "workspace.changed";
      workspaceId: string;
      revision: number;
      source: ChangeSource;
      message?: string;
    }
  | {
      type: "model.changed";
      workspaceId: string;
      revision: number;
      source: ChangeSource;
      message?: string;
    }
  | {
      type: "view.changed";
      workspaceId: string;
      viewId: string;
      revision: number;
      source: ChangeSource;
    }
  | { type: "record.changed"; workspaceId: string; revision: number; source: ChangeSource }
  | { type: "workspace.deleted"; workspaceId: string; source: ChangeSource };

export interface EventBus {
  emit(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}

export class InMemoryEventBus implements EventBus {
  private listeners = new Set<(event: DomainEvent) => void>();

  emit(event: DomainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* a broken subscriber must never break a domain mutation */
      }
    }
  }

  subscribe(listener: (event: DomainEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
