import { describe, expect, test } from "bun:test";
import { initialViewElementIds } from "./viewSeed";

const elements = [
  { id: "customer", parentId: null },
  { id: "payments", parentId: null },
  { id: "checkout", parentId: "payments" },
  { id: "ledger", parentId: "payments" },
  { id: "repository", parentId: "ledger" },
  { id: "unrelated", parentId: null },
];

describe("new view element seeding", () => {
  test("includes every workspace element when the view has no scope", () => {
    expect(initialViewElementIds(elements, null)).toEqual(elements.map((element) => element.id));
  });

  test("includes only descendants when the view has a scope", () => {
    expect(initialViewElementIds(elements, "payments")).toEqual([
      "checkout",
      "ledger",
      "repository",
    ]);
  });
});
