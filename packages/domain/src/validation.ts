import type {
  ValidationIssue,
  ValidationResult,
  WorkspaceDocument,
} from "@structsmith/contracts";
import { checkParent, wouldCreateCycle } from "./rules";

/**
 * Deterministic architecture validator (spec §41). Not every finding is an
 * error — most are hints an architect may deliberately ignore.
 */
export function validateDocument(document: WorkspaceDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { elements, relationships, views } = document;
  const byId = new Map(elements.map((element) => [element.id, element]));

  const elementsInViews = new Set<string>();
  for (const view of views) {
    for (const entry of view.elements) if (!entry.hidden) elementsInViews.add(entry.elementId);
  }

  const seenViewKeys = new Set<string>();
  for (const view of views) {
    if (seenViewKeys.has(view.key)) {
      issues.push({
        level: "error",
        code: "DUPLICATE_VIEW_KEY",
        message: `Two views share the key "${view.key}".`,
        viewId: view.id,
      });
    }
    seenViewKeys.add(view.key);
    if (view.scopeElementId && !byId.has(view.scopeElementId)) {
      issues.push({
        level: "error",
        code: "VIEW_SCOPE_MISSING",
        message: `View "${view.name}" is scoped to an element that no longer exists.`,
        viewId: view.id,
      });
    }
  }

  for (const element of elements) {
    const parent = element.parentId ? byId.get(element.parentId) : undefined;

    if (element.parentId && !parent) {
      issues.push({
        level: "error",
        code: "PARENT_MISSING",
        message: `"${element.name}" references a parent that does not exist.`,
        elementId: element.id,
      });
    }

    const problem = checkParent(element, parent);
    if (problem) {
      issues.push({
        level: "error",
        code: problem.code,
        message: problem.message,
        elementId: element.id,
      });
    }

    if (
      wouldCreateCycle(element.id, element.parentId, (id) => byId.get(id)?.parentId ?? null)
    ) {
      issues.push({
        level: "error",
        code: "HIERARCHY_CYCLE",
        message: `"${element.name}" is part of a containment cycle.`,
        elementId: element.id,
      });
    }

    if (element.kind === "container" && !element.parentId) {
      issues.push({
        level: "warning",
        code: "CONTAINER_WITHOUT_SYSTEM",
        message: `Container "${element.name}" has no parent software system.`,
        elementId: element.id,
      });
    }

    if (element.kind === "component" && !element.parentId) {
      issues.push({
        level: "warning",
        code: "COMPONENT_WITHOUT_CONTAINER",
        message: `Component "${element.name}" has no parent container.`,
        elementId: element.id,
      });
    }

    if (element.role === "database" && !element.technology) {
      issues.push({
        level: "warning",
        code: "DATABASE_WITHOUT_TECHNOLOGY",
        message: `Database "${element.name}" has no technology set.`,
        elementId: element.id,
      });
    }

    if (element.kind === "softwareSystem" && !element.description && !element.external) {
      issues.push({
        level: "info",
        code: "SYSTEM_WITHOUT_DESCRIPTION",
        message: `Software system "${element.name}" has no description.`,
        elementId: element.id,
      });
    }

    if (views.length > 0 && !elementsInViews.has(element.id)) {
      issues.push({
        level: "info",
        code: "ELEMENT_NOT_IN_ANY_VIEW",
        message: `"${element.name}" does not appear in any view.`,
        elementId: element.id,
      });
    }
  }

  const connected = new Set<string>();
  for (const relationship of relationships) {
    connected.add(relationship.sourceElementId);
    connected.add(relationship.targetElementId);

    const source = byId.get(relationship.sourceElementId);
    const target = byId.get(relationship.targetElementId);

    if (!source || !target) {
      issues.push({
        level: "error",
        code: "RELATIONSHIP_ENDPOINT_MISSING",
        message: "A relationship points at an element that does not exist.",
        relationshipId: relationship.id,
      });
      continue;
    }

    if (source.id === target.id) {
      issues.push({
        level: "warning",
        code: "SELF_RELATIONSHIP",
        message: `"${source.name}" is connected to itself.`,
        relationshipId: relationship.id,
      });
    }

    if (!relationship.description) {
      issues.push({
        level: "warning",
        code: "RELATIONSHIP_WITHOUT_DESCRIPTION",
        message: `The relationship ${source.name} → ${target.name} has no description.`,
        relationshipId: relationship.id,
      });
    }

    if (source.kind === "person" && target.role === "database") {
      issues.push({
        level: "warning",
        code: "PERSON_TO_DATABASE",
        message: `"${source.name}" talks directly to the database "${target.name}".`,
        relationshipId: relationship.id,
      });
    }
  }

  for (const element of elements) {
    const hasChildren = elements.some((candidate) => candidate.parentId === element.id);
    if (!connected.has(element.id) && !hasChildren && elements.length > 1) {
      issues.push({
        level: "info",
        code: "ORPHAN_ELEMENT",
        message: `"${element.name}" has no relationships.`,
        elementId: element.id,
      });
    }
  }

  return { valid: !issues.some((issue) => issue.level === "error"), issues };
}
