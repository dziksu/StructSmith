import { describe, expect, test } from "bun:test";
import { computeLayout, type LayoutNode } from "@structsmith/domain";

const nodes: LayoutNode[] = [
  { id: "a", width: 220, height: 120, x: 20, y: 40 },
  { id: "b", width: 180, height: 96, x: 340, y: 40 },
  { id: "c", width: 240, height: 150, x: 340, y: 260 },
  { id: "d", width: 200, height: 110, x: 680, y: 150 },
  { id: "e", width: 190, height: 130, x: 100, y: 420 },
];

const edges = [
  { source: "a", target: "b" },
  { source: "a", target: "c" },
  { source: "b", target: "d" },
  { source: "c", target: "d" },
];

function overlaps(
  left: LayoutNode,
  right: LayoutNode,
  positions: Map<string, { x: number; y: number }>,
) {
  const a = positions.get(left.id);
  const b = positions.get(right.id);
  if (!a || !b) return false;
  const gap = 1;
  return !(
    a.x + (left.width ?? 220) + gap <= b.x ||
    b.x + (right.width ?? 220) + gap <= a.x ||
    a.y + (left.height ?? 96) + gap <= b.y ||
    b.y + (right.height ?? 96) + gap <= a.y
  );
}

describe("additional layout algorithms", () => {
  for (const algorithm of ["force", "radial", "grid"] as const) {
    test(`${algorithm} is deterministic and avoids card overlaps`, () => {
      const first = computeLayout(nodes, edges, "LR", algorithm, "a");
      expect(computeLayout(nodes, edges, "LR", algorithm, "a")).toEqual(first);
      expect(first).toHaveLength(nodes.length);
      const positions = new Map(first.map((position) => [position.id, position] as const));
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const leftNode = nodes[left];
          const rightNode = nodes[right];
          if (leftNode && rightNode) expect(overlaps(leftNode, rightNode, positions)).toBe(false);
        }
      }
    });
  }

  test("radial places the requested root at the center", () => {
    const positions = computeLayout(nodes, edges, "LR", "radial", "a");
    const root = positions.find((position) => position.id === "a");
    if (!root) throw new Error("Missing radial root");
    const rootCenter = { x: root.x + 110, y: root.y + 60 };
    const distances = positions
      .filter((position) => position.id !== "a")
      .map((position) => Math.hypot(position.x - rootCenter.x, position.y - rootCenter.y));
    expect(Math.min(...distances)).toBeGreaterThan(100);
  });

  test("force preserves locked coordinates", () => {
    const locked = nodes.map((node) => (node.id === "a" ? { ...node, locked: true } : node));
    const root = computeLayout(locked, edges, "LR", "force").find(
      (position) => position.id === "a",
    );
    expect(root).toEqual({ id: "a", x: 20, y: 40 });
  });
});
