import { expect, test } from "bun:test";
import { createTestContext } from "./helpers";

test("official Mermaid system diagram preserves all 22 nodes and 40 relationships", async () => {
  const source = await Bun.file(
    new URL("./fixtures/mermaid/official-large-flowchart.mmd", import.meta.url),
  ).text();
  // This fixture has an intentionally simple independent oracle: explicit
  // quoted node declarations followed by plain directed edges, one per line.
  const expectedNodes = [...source.matchAll(/^\s*(\w+)\("([^"]+)"\)/gm)].map((match) => ({
    rawId: match[1],
    name: match[2],
  }));
  const expectedEdges = [...source.matchAll(/^\s*(\w+)-->(\w+)\s*$/gm)]
    .map((match) => `${match[1]}->${match[2]}`)
    .sort();
  expect(expectedNodes).toHaveLength(22);
  expect(expectedEdges).toHaveLength(40);

  const { services, close } = createTestContext();
  try {
    const workspace = services.imports.importMermaid(source);
    const document = services.model.getDocument(workspace.id);
    const rawIds = new Map(
      document.elements.map((node) => [node.id, node.properties["mermaid.id"]]),
    );
    expect(document.elements).toHaveLength(expectedNodes.length);
    for (const expected of expectedNodes) {
      expect(document.elements.find((node) => rawIds.get(node.id) === expected.rawId)?.name).toBe(
        expected.name,
      );
    }
    expect(
      document.relationships
        .map((edge) => `${rawIds.get(edge.sourceElementId)}->${rawIds.get(edge.targetElementId)}`)
        .sort(),
    ).toEqual(expectedEdges);

    const view = document.views[0];
    if (!view) throw new Error("Imported view is missing");
    expect(view.elements.map((entry) => entry.elementId).sort()).toEqual(
      document.elements.map((node) => node.id).sort(),
    );
    expect(view.relationships.map((entry) => entry.relationshipId).sort()).toEqual(
      document.relationships.map((edge) => edge.id).sort(),
    );
    for (const card of view.elements) {
      expect(Number.isFinite(card.x) && Number.isFinite(card.y)).toBe(true);
      expect(card.width).toBeGreaterThan(0);
      expect(card.height).toBeGreaterThan(0);
    }
    const overlaps: string[] = [];
    for (const [index, first] of view.elements.entries()) {
      for (const second of view.elements.slice(index + 1)) {
        if (
          first.x < second.x + (second.width ?? 0) &&
          first.x + (first.width ?? 0) > second.x &&
          first.y < second.y + (second.height ?? 0) &&
          first.y + (first.height ?? 0) > second.y
        ) {
          overlaps.push(`${first.elementId}/${second.elementId}`);
        }
      }
    }
    expect(overlaps).toEqual([]);
  } finally {
    close();
  }
});
