import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
  CreateElementInput,
  CreateRecordInput,
  CreateRelationshipInput,
  CreateViewInput,
  LayoutDirection,
  LayoutEntry,
  UpdateElementInput,
  UpdateRecordInput,
  UpdateRelationshipInput,
  UpdateViewInput,
  ViewElement,
  ViewRelationship,
  ViewRelationshipPatch,
  ViewSettings,
  Workspace,
  WorkspaceMode,
} from "@structsmith/contracts";
import { ERROR_CODES } from "@structsmith/contracts";
import { badRequest, DomainError, ruleViolation } from "./errors";
import { createId, nowIso, uniqueKey } from "./ids";
import { edgeLabel, resolveRelationshipsForView } from "./implied";
import { computeLayout, DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "./layout";
import type { Repositories } from "./ports";
import { checkParent, descendantsOf, wouldCreateCycle } from "./rules";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const defaultViewSettings: ViewSettings = {
  showBoundaries: true,
  snapToGrid: false,
  autoLayoutDirection: "LR",
};

const GRID_COLUMNS = 4;
const GRID_X = 300;
const GRID_Y = 180;

function requireElement(repos: Repositories, id: string, workspaceId: string): ArchitectureElement {
  const element = repos.elements.findById(id);
  if (!element || element.workspaceId !== workspaceId) {
    throw new DomainError(ERROR_CODES.ELEMENT_NOT_FOUND, `Element "${id}" does not exist.`, 404);
  }
  return element;
}

function requireView(repos: Repositories, id: string, workspaceId: string): ArchitectureView {
  const view = repos.views.findById(id);
  if (!view || view.workspaceId !== workspaceId) {
    throw new DomainError(ERROR_CODES.VIEW_NOT_FOUND, `View "${id}" does not exist.`, 404);
  }
  return view;
}

function enforceHierarchy(
  mode: WorkspaceMode,
  child: Pick<ArchitectureElement, "kind" | "name">,
  parent: ArchitectureElement | undefined,
  warnings: string[],
): void {
  const problem = checkParent(child, parent);
  if (!problem) return;
  if (mode === "strict") throw ruleViolation(problem.message, { code: problem.code });
  warnings.push(problem.message);
}

function nextGridPosition(existing: readonly ViewElement[]): { x: number; y: number } {
  const index = existing.length;
  return { x: (index % GRID_COLUMNS) * GRID_X, y: Math.floor(index / GRID_COLUMNS) * GRID_Y };
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

export function createElement(
  repos: Repositories,
  workspace: Workspace,
  input: CreateElementInput,
  warnings: string[] = [],
): ArchitectureElement {
  const parent = input.parentId ? requireElement(repos, input.parentId, workspace.id) : undefined;
  enforceHierarchy(workspace.mode, { kind: input.kind, name: input.name }, parent, warnings);

  const id = input.id ?? createId(input.name);
  if (repos.elements.findById(id)) {
    throw badRequest(`Element id "${id}" is already taken.`);
  }

  const timestamp = nowIso();
  const element: ArchitectureElement = {
    id,
    workspaceId: workspace.id,
    parentId: input.parentId ?? null,
    kind: input.kind,
    role: input.role ?? null,
    name: input.name,
    description: input.description ?? null,
    technology: input.technology ?? null,
    external: input.external ?? false,
    tags: input.tags ?? [],
    properties: input.properties ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  repos.elements.insert(element);
  return element;
}

export function updateElement(
  repos: Repositories,
  workspace: Workspace,
  elementId: string,
  input: UpdateElementInput,
  warnings: string[] = [],
): ArchitectureElement {
  const current = requireElement(repos, elementId, workspace.id);

  let parentId = current.parentId;
  if (input.parentId !== undefined) {
    parentId = input.parentId;
    if (parentId === elementId) throw badRequest("An element cannot be its own parent.");
    if (parentId) {
      const parent = requireElement(repos, parentId, workspace.id);
      enforceHierarchy(
        workspace.mode,
        { kind: input.kind ?? current.kind, name: input.name ?? current.name },
        parent,
        warnings,
      );
      const all = repos.elements.listByWorkspace(workspace.id);
      const parentOf = new Map(all.map((item) => [item.id, item.parentId]));
      if (wouldCreateCycle(elementId, parentId, (id) => parentOf.get(id) ?? null)) {
        throw ruleViolation("That change would create a containment cycle.");
      }
    }
  }

  const next: ArchitectureElement = {
    ...current,
    parentId,
    kind: input.kind ?? current.kind,
    role: input.role !== undefined ? input.role : current.role,
    name: input.name ?? current.name,
    description:
      input.description !== undefined ? (input.description ?? null) : current.description,
    technology: input.technology !== undefined ? (input.technology ?? null) : current.technology,
    external: input.external ?? current.external,
    tags: input.tags ?? current.tags,
    properties: input.properties ?? current.properties,
    updatedAt: nowIso(),
  };
  repos.elements.update(next);
  return next;
}

export function deleteElement(
  repos: Repositories,
  workspace: Workspace,
  elementId: string,
  cascade = true,
): string[] {
  const element = requireElement(repos, elementId, workspace.id);
  const all = repos.elements.listByWorkspace(workspace.id);
  const targets = cascade ? [element, ...descendantsOf(elementId, all)] : [element];

  if (!cascade) {
    for (const child of all.filter((item) => item.parentId === elementId)) {
      repos.elements.update({ ...child, parentId: element.parentId, updatedAt: nowIso() });
    }
  }

  for (const target of targets) {
    for (const relationshipId of repos.relationships.deleteByElement(target.id)) {
      repos.views.removeRelationshipEverywhere(relationshipId);
    }
    repos.views.removeElementEverywhere(target.id);
    repos.records.removeElementLinks(target.id);
    repos.elements.delete(target.id);
  }

  return targets.map((target) => target.id);
}

/* ------------------------------------------------------------------ */
/* Relationships                                                       */
/* ------------------------------------------------------------------ */

export function createRelationship(
  repos: Repositories,
  workspace: Workspace,
  input: CreateRelationshipInput,
): ArchitectureRelationship {
  requireElement(repos, input.sourceElementId, workspace.id);
  requireElement(repos, input.targetElementId, workspace.id);

  const id = input.id ?? createId("rel");
  if (repos.relationships.findById(id)) {
    throw badRequest(`Relationship id "${id}" is already taken.`);
  }

  const timestamp = nowIso();
  const relationship: ArchitectureRelationship = {
    id,
    workspaceId: workspace.id,
    sourceElementId: input.sourceElementId,
    targetElementId: input.targetElementId,
    description: input.description ?? null,
    technology: input.technology ?? null,
    interactionStyle: input.interactionStyle ?? "sync",
    tags: input.tags ?? [],
    properties: input.properties ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  repos.relationships.insert(relationship);
  return relationship;
}

export function updateRelationship(
  repos: Repositories,
  workspace: Workspace,
  relationshipId: string,
  input: UpdateRelationshipInput,
): ArchitectureRelationship {
  const current = repos.relationships.findById(relationshipId);
  if (!current || current.workspaceId !== workspace.id) {
    throw new DomainError(
      ERROR_CODES.RELATIONSHIP_NOT_FOUND,
      `Relationship "${relationshipId}" does not exist.`,
      404,
    );
  }
  if (input.sourceElementId) requireElement(repos, input.sourceElementId, workspace.id);
  if (input.targetElementId) requireElement(repos, input.targetElementId, workspace.id);

  const next: ArchitectureRelationship = {
    ...current,
    sourceElementId: input.sourceElementId ?? current.sourceElementId,
    targetElementId: input.targetElementId ?? current.targetElementId,
    description:
      input.description !== undefined ? (input.description ?? null) : current.description,
    technology: input.technology !== undefined ? (input.technology ?? null) : current.technology,
    interactionStyle: input.interactionStyle ?? current.interactionStyle,
    tags: input.tags ?? current.tags,
    properties: input.properties ?? current.properties,
    updatedAt: nowIso(),
  };
  repos.relationships.update(next);
  return next;
}

export function deleteRelationship(
  repos: Repositories,
  workspace: Workspace,
  relationshipId: string,
): void {
  const current = repos.relationships.findById(relationshipId);
  if (!current || current.workspaceId !== workspace.id) {
    throw new DomainError(
      ERROR_CODES.RELATIONSHIP_NOT_FOUND,
      `Relationship "${relationshipId}" does not exist.`,
      404,
    );
  }
  repos.views.removeRelationshipEverywhere(relationshipId);
  repos.relationships.delete(relationshipId);
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

export function createView(
  repos: Repositories,
  workspace: Workspace,
  input: CreateViewInput,
): ArchitectureView {
  if (input.scopeElementId) requireElement(repos, input.scopeElementId, workspace.id);

  const keys = new Set(repos.views.listByWorkspace(workspace.id).map((view) => view.key));
  const key =
    input.key && !keys.has(input.key) ? input.key : uniqueKey(keys, input.key ?? input.name);

  const timestamp = nowIso();
  const view: ArchitectureView = {
    id: input.id ?? createId(input.name),
    workspaceId: workspace.id,
    key,
    name: input.name,
    description: input.description ?? null,
    kind: input.kind,
    scopeElementId: input.scopeElementId ?? null,
    settings: { ...defaultViewSettings, ...(input.settings ?? {}) },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  repos.views.insert(view);

  if (input.elementIds?.length) {
    setViewElements(repos, workspace, view.id, input.elementIds, "add");
  }
  return view;
}

export function updateView(
  repos: Repositories,
  workspace: Workspace,
  viewId: string,
  input: UpdateViewInput,
): ArchitectureView {
  const current = requireView(repos, viewId, workspace.id);
  if (input.scopeElementId) requireElement(repos, input.scopeElementId, workspace.id);

  if (input.key && input.key !== current.key) {
    const taken = repos.views
      .listByWorkspace(workspace.id)
      .some((view) => view.id !== viewId && view.key === input.key);
    if (taken) throw badRequest(`View key "${input.key}" is already used in this workspace.`);
  }

  const next: ArchitectureView = {
    ...current,
    key: input.key ?? current.key,
    name: input.name ?? current.name,
    description:
      input.description !== undefined ? (input.description ?? null) : current.description,
    kind: input.kind ?? current.kind,
    scopeElementId:
      input.scopeElementId !== undefined ? (input.scopeElementId ?? null) : current.scopeElementId,
    settings: { ...current.settings, ...(input.settings ?? {}) },
    updatedAt: nowIso(),
  };
  repos.views.update(next);
  return next;
}

export function deleteView(repos: Repositories, workspace: Workspace, viewId: string): void {
  requireView(repos, viewId, workspace.id);
  repos.views.delete(viewId);
}

export function setViewElements(
  repos: Repositories,
  workspace: Workspace,
  viewId: string,
  elementIds: readonly string[],
  mode: "replace" | "add" | "remove" = "add",
): ViewElement[] {
  requireView(repos, viewId, workspace.id);
  const wanted = new Set(elementIds);
  const existing = repos.views.listElements(viewId);
  const existingIds = new Set(existing.map((entry) => entry.elementId));

  if (mode === "remove") {
    for (const elementId of wanted) repos.views.removeElement(viewId, elementId);
    return repos.views.listElements(viewId);
  }

  if (mode === "replace") {
    for (const entry of existing) {
      if (!wanted.has(entry.elementId)) repos.views.removeElement(viewId, entry.elementId);
    }
  }

  let placed = mode === "replace" ? [] : [...existing];
  for (const elementId of elementIds) {
    if (existingIds.has(elementId)) continue;
    requireElement(repos, elementId, workspace.id);
    const position = nextGridPosition(placed);
    const entry: ViewElement = {
      viewId,
      elementId,
      x: position.x,
      y: position.y,
      width: null,
      height: null,
      hidden: false,
      locked: false,
      zIndex: 0,
    };
    repos.views.upsertElement(entry);
    placed = [...placed, entry];
  }

  return repos.views.listElements(viewId);
}

export function setLayout(
  repos: Repositories,
  workspace: Workspace,
  viewId: string,
  entries: readonly LayoutEntry[],
): ViewElement[] {
  requireView(repos, viewId, workspace.id);
  const current = new Map(
    repos.views.listElements(viewId).map((entry) => [entry.elementId, entry] as const),
  );

  for (const entry of entries) {
    const existing = current.get(entry.elementId);
    const base: ViewElement = existing ?? {
      viewId,
      elementId: entry.elementId,
      x: 0,
      y: 0,
      width: null,
      height: null,
      hidden: false,
      locked: false,
      zIndex: 0,
    };
    if (!existing) requireElement(repos, entry.elementId, workspace.id);

    repos.views.upsertElement({
      ...base,
      x: entry.x ?? base.x,
      y: entry.y ?? base.y,
      width: entry.width !== undefined ? entry.width : base.width,
      height: entry.height !== undefined ? entry.height : base.height,
      hidden: entry.hidden ?? base.hidden,
      locked: entry.locked ?? base.locked,
      zIndex: entry.zIndex ?? base.zIndex,
    });
  }

  return repos.views.listElements(viewId);
}

export function setViewRelationships(
  repos: Repositories,
  workspace: Workspace,
  viewId: string,
  patches: readonly ViewRelationshipPatch[],
): ViewRelationship[] {
  requireView(repos, viewId, workspace.id);
  const current = new Map(
    repos.views.listRelationships(viewId).map((entry) => [entry.relationshipId, entry] as const),
  );

  for (const patch of patches) {
    const base: ViewRelationship = current.get(patch.relationshipId) ?? {
      viewId,
      relationshipId: patch.relationshipId,
      hidden: false,
      labelPosition: null,
      controlPoints: [],
    };
    repos.views.upsertRelationship({
      ...base,
      hidden: patch.hidden ?? base.hidden,
      labelPosition: patch.labelPosition !== undefined ? patch.labelPosition : base.labelPosition,
      controlPoints: patch.controlPoints ?? base.controlPoints,
    });
  }

  return repos.views.listRelationships(viewId);
}

export function autoLayoutView(
  repos: Repositories,
  workspace: Workspace,
  viewId: string,
  direction: LayoutDirection = "LR",
): ViewElement[] {
  requireView(repos, viewId, workspace.id);
  const entries = repos.views.listElements(viewId).filter((entry) => !entry.hidden);
  if (entries.length === 0) return [];

  const allElements = repos.elements.listByWorkspace(workspace.id);
  const elements = new Map(allElements.map((element) => [element.id, element] as const));
  const visible = new Set(entries.map((entry) => entry.elementId));

  const positions = computeLayout(
    entries.map((entry) => ({
      id: entry.elementId,
      width: entry.width ?? DEFAULT_NODE_WIDTH,
      height: entry.height ?? DEFAULT_NODE_HEIGHT,
      parentId: elements.get(entry.elementId)?.parentId ?? null,
    })),
    resolveRelationshipsForView(
      allElements,
      repos.relationships.listByWorkspace(workspace.id),
      visible,
    ).map((edge) => ({
      source: edge.sourceElementId,
      target: edge.targetElementId,
      label: edgeLabel(edge),
    })),
    direction,
  );

  const byId = new Map(entries.map((entry) => [entry.elementId, entry] as const));
  for (const position of positions) {
    const entry = byId.get(position.id);
    if (!entry || entry.locked) continue;
    repos.views.upsertElement({ ...entry, x: position.x, y: position.y });
  }

  return repos.views.listElements(viewId);
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export function createRecord(
  repos: Repositories,
  workspace: Workspace,
  input: CreateRecordInput,
): ArchitectureRecord {
  const linked = input.linkedElementIds ?? [];
  for (const elementId of linked) requireElement(repos, elementId, workspace.id);

  const timestamp = nowIso();
  const record: ArchitectureRecord = {
    id: input.id ?? createId(input.title),
    workspaceId: workspace.id,
    kind: input.kind,
    title: input.title,
    contentMd: input.contentMd ?? null,
    status: input.status ?? "open",
    severity: input.severity ?? null,
    linkedElementIds: linked,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  repos.records.insert(record);
  return record;
}

export function updateRecord(
  repos: Repositories,
  workspace: Workspace,
  recordId: string,
  input: UpdateRecordInput,
): ArchitectureRecord {
  const current = repos.records.findById(recordId);
  if (!current || current.workspaceId !== workspace.id) {
    throw new DomainError(
      ERROR_CODES.RECORD_NOT_FOUND,
      `Record "${recordId}" does not exist.`,
      404,
    );
  }
  if (input.linkedElementIds) {
    for (const elementId of input.linkedElementIds) requireElement(repos, elementId, workspace.id);
  }

  const next: ArchitectureRecord = {
    ...current,
    kind: input.kind ?? current.kind,
    title: input.title ?? current.title,
    contentMd: input.contentMd !== undefined ? (input.contentMd ?? null) : current.contentMd,
    status: input.status ?? current.status,
    severity: input.severity !== undefined ? (input.severity ?? null) : current.severity,
    linkedElementIds: input.linkedElementIds ?? current.linkedElementIds,
    updatedAt: nowIso(),
  };
  repos.records.update(next);
  return next;
}

export function deleteRecord(repos: Repositories, workspace: Workspace, recordId: string): void {
  const current = repos.records.findById(recordId);
  if (!current || current.workspaceId !== workspace.id) {
    throw new DomainError(
      ERROR_CODES.RECORD_NOT_FOUND,
      `Record "${recordId}" does not exist.`,
      404,
    );
  }
  repos.records.delete(recordId);
}
