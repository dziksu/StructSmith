import type {
  ActivityEntry,
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
  ChangeSource,
  ElementKind,
  ElementRole,
  InteractionStyle,
  RecordKind,
  RecordStatus,
  Severity,
  ViewElement,
  ViewKind,
  ViewRelationship,
  ViewSettings,
  Workspace,
  WorkspaceMode,
} from "@structsmith/contracts";
import type {
  activity,
  elements,
  records,
  relationships,
  viewElements,
  viewRelationships,
  views,
  workspaces,
} from "./schema";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const toBool = (value: number): boolean => value !== 0;
export const fromBool = (value: boolean): number => (value ? 1 : 0);

export function toWorkspace(row: Row<typeof workspaces>): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    mode: row.mode as WorkspaceMode,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function fromWorkspace(workspace: Workspace): Row<typeof workspaces> {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    mode: workspace.mode,
    revision: workspace.revision,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export function toElement(row: Row<typeof elements>): ArchitectureElement {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    parentId: row.parentId,
    kind: row.kind as ElementKind,
    role: (row.role as ElementRole | null) ?? null,
    name: row.name,
    description: row.description,
    technology: row.technology,
    external: toBool(row.external),
    tags: parseJson<string[]>(row.tagsJson, []),
    properties: parseJson<Record<string, string>>(row.propertiesJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function fromElement(element: ArchitectureElement): Row<typeof elements> {
  return {
    id: element.id,
    workspaceId: element.workspaceId,
    parentId: element.parentId,
    kind: element.kind,
    role: element.role,
    name: element.name,
    description: element.description,
    technology: element.technology,
    external: fromBool(element.external),
    tagsJson: JSON.stringify(element.tags),
    propertiesJson: JSON.stringify(element.properties),
    createdAt: element.createdAt,
    updatedAt: element.updatedAt,
  };
}

export function toRelationship(row: Row<typeof relationships>): ArchitectureRelationship {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceElementId: row.sourceElementId,
    targetElementId: row.targetElementId,
    description: row.description,
    technology: row.technology,
    interactionStyle: row.interactionStyle as InteractionStyle,
    tags: parseJson<string[]>(row.tagsJson, []),
    properties: parseJson<Record<string, string>>(row.propertiesJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function fromRelationship(
  relationship: ArchitectureRelationship,
): Row<typeof relationships> {
  return {
    id: relationship.id,
    workspaceId: relationship.workspaceId,
    sourceElementId: relationship.sourceElementId,
    targetElementId: relationship.targetElementId,
    description: relationship.description,
    technology: relationship.technology,
    interactionStyle: relationship.interactionStyle,
    tagsJson: JSON.stringify(relationship.tags),
    propertiesJson: JSON.stringify(relationship.properties),
    createdAt: relationship.createdAt,
    updatedAt: relationship.updatedAt,
  };
}

const defaultSettings: ViewSettings = {
  showBoundaries: true,
  snapToGrid: false,
  autoLayoutDirection: "LR",
};

export function toView(row: Row<typeof views>): ArchitectureView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    key: row.key,
    name: row.name,
    description: row.description,
    kind: row.kind as ViewKind,
    scopeElementId: row.scopeElementId,
    settings: { ...defaultSettings, ...parseJson<Partial<ViewSettings>>(row.settingsJson, {}) },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function fromView(view: ArchitectureView): Row<typeof views> {
  return {
    id: view.id,
    workspaceId: view.workspaceId,
    key: view.key,
    kind: view.kind,
    name: view.name,
    description: view.description,
    scopeElementId: view.scopeElementId,
    settingsJson: JSON.stringify(view.settings),
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

export function toViewElement(row: Row<typeof viewElements>): ViewElement {
  return {
    viewId: row.viewId,
    elementId: row.elementId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    hidden: toBool(row.hidden),
    locked: toBool(row.locked),
    zIndex: row.zIndex,
  };
}

export function fromViewElement(entry: ViewElement): Row<typeof viewElements> {
  return {
    viewId: entry.viewId,
    elementId: entry.elementId,
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
    hidden: fromBool(entry.hidden),
    locked: fromBool(entry.locked),
    zIndex: entry.zIndex,
  };
}

export function toViewRelationship(row: Row<typeof viewRelationships>): ViewRelationship {
  return {
    viewId: row.viewId,
    relationshipId: row.relationshipId,
    hidden: toBool(row.hidden),
    labelPosition: row.labelPosition,
    controlPoints: parseJson<{ x: number; y: number }[]>(row.controlPointsJson, []),
  };
}

export function fromViewRelationship(entry: ViewRelationship): Row<typeof viewRelationships> {
  return {
    viewId: entry.viewId,
    relationshipId: entry.relationshipId,
    hidden: fromBool(entry.hidden),
    labelPosition: entry.labelPosition,
    controlPointsJson: JSON.stringify(entry.controlPoints),
  };
}

export function toRecord(
  row: Row<typeof records>,
  linkedElementIds: string[],
): ArchitectureRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind as RecordKind,
    title: row.title,
    contentMd: row.contentMd,
    status: row.status as RecordStatus,
    severity: (row.severity as Severity | null) ?? null,
    linkedElementIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function fromRecord(record: ArchitectureRecord): Row<typeof records> {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    kind: record.kind,
    title: record.title,
    contentMd: record.contentMd,
    status: record.status,
    severity: record.severity,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toActivity(row: Row<typeof activity>): ActivityEntry {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    source: row.source as ChangeSource,
    message: row.message,
    createdAt: row.createdAt,
  };
}
