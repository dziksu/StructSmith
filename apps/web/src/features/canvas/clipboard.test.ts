import { describe, expect, test } from "bun:test";
import type {
  ArchitectureElement,
  ArchitectureRelationship,
  ViewDetail,
} from "@structsmith/contracts";
import { buildPasteOperations, createDiagramClipboard } from "./clipboard";

const timestamp = "2026-01-01T00:00:00.000Z";
const element = (id: string, parentId: string | null = null): ArchitectureElement => ({
  id,
  workspaceId: "workspace",
  parentId,
  kind: "container",
  role: null,
  name: id,
  description: null,
  technology: null,
  external: false,
  tags: [],
  properties: {},
  createdAt: timestamp,
  updatedAt: timestamp,
});

const relationship: ArchitectureRelationship = {
  id: "relationship",
  workspaceId: "workspace",
  sourceElementId: "one",
  targetElementId: "two",
  description: "calls",
  technology: "HTTP",
  interactionStyle: "sync",
  tags: [],
  properties: {},
  createdAt: timestamp,
  updatedAt: timestamp,
};

const view: ViewDetail = {
  id: "view",
  workspaceId: "workspace",
  key: "view",
  name: "View",
  description: null,
  kind: "container",
  scopeElementId: null,
  settings: {
    showBoundaries: true,
    snapToGrid: false,
    autoLayoutDirection: "LR",
    autoLayoutAlgorithm: "dagre",
    boundaryLayer: "deployment",
    relationshipRouting: "orthogonal",
    showRelationshipLabels: true,
    showFullTitles: false,
    showDescriptions: false,
  },
  createdAt: timestamp,
  updatedAt: timestamp,
  elements: [
    {
      viewId: "view",
      elementId: "one",
      x: 10,
      y: 20,
      width: null,
      height: null,
      hidden: false,
      locked: false,
      zIndex: 0,
    },
    {
      viewId: "view",
      elementId: "two",
      x: 100,
      y: 120,
      width: null,
      height: null,
      hidden: false,
      locked: false,
      zIndex: 0,
    },
  ],
  relationships: [],
  boundaries: [],
};

describe("diagram clipboard", () => {
  test("copies only relationships internal to the selected group", () => {
    const externalRelationship = { ...relationship, id: "external", targetElementId: "three" };
    const clipboard = createDiagramClipboard(
      "workspace",
      view,
      [element("one"), element("two", "one"), element("three")],
      [relationship, externalRelationship],
      ["one", "two"],
    );

    expect(clipboard?.elements.map((item) => item.id)).toEqual(["one", "two"]);
    expect(clipboard?.relationships.map((item) => item.id)).toEqual(["relationship"]);
  });

  test("pastes elements, hierarchy, layout and internal relationships in one batch", () => {
    const clipboard = createDiagramClipboard(
      "workspace",
      view,
      [element("one"), element("two", "one")],
      [relationship],
      ["one", "two"],
    );
    if (!clipboard) throw new Error("Expected clipboard data");

    const operations = buildPasteOperations(clipboard, "workspace", "view");
    expect(operations.map((operation) => operation.op)).toEqual([
      "createElement",
      "createElement",
      "setViewElements",
      "setLayout",
      "createRelationship",
    ]);
    expect(operations[1]).toMatchObject({
      op: "createElement",
      data: { parentId: "@copy-element-0" },
    });
    expect(operations[3]).toMatchObject({
      op: "setLayout",
      entries: [
        { elementId: "@copy-element-0", x: 50, y: 60 },
        { elementId: "@copy-element-1", x: 140, y: 160 },
      ],
    });
    expect(operations[4]).toMatchObject({
      op: "createRelationship",
      data: {
        sourceElementId: "@copy-element-0",
        targetElementId: "@copy-element-1",
      },
    });
  });
});
