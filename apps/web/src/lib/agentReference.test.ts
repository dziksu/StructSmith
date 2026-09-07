import { expect, test } from "bun:test";
import {
  buildAgentReference,
  formatAgentReference,
  parseReferenceSearchValue,
} from "./agentReference";

test("builds a machine-readable reference with a deep link", () => {
  const reference = buildAgentReference(
    {
      type: "element",
      workspaceId: "workspace-1",
      targetId: "element-1",
      label: "Mobile app",
      viewId: "view-1",
    },
    "http://localhost:3500",
  );

  expect(reference).toEqual({
    version: 1,
    type: "element",
    workspaceId: "workspace-1",
    targetId: "element-1",
    label: "Mobile app",
    viewId: "view-1",
    url: "http://localhost:3500/w/workspace-1?view=view-1&ref=element%3Aelement-1",
  });
  expect(formatAgentReference(reference, "http://localhost:3500")).toStartWith("StructSmithRef {");
});

test("parses supported deep-link targets and rejects invalid values", () => {
  expect(parseReferenceSearchValue("relationship:rel-1")).toEqual({
    type: "relationship",
    targetId: "rel-1",
  });
  expect(parseReferenceSearchValue("unknown:item-1")).toBeNull();
  expect(parseReferenceSearchValue("element:")).toBeNull();
});
