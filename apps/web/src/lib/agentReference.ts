import type { ReferenceTargetKind, StructSmithReference } from "@structsmith/contracts";

export interface AgentReferenceInput {
  type: ReferenceTargetKind;
  workspaceId: string;
  targetId: string;
  label?: string;
  viewId?: string | null;
}

export function referenceSearchValue(type: ReferenceTargetKind, targetId: string): string {
  return `${type}:${targetId}`;
}

export function parseReferenceSearchValue(
  value: string | undefined,
): { type: ReferenceTargetKind; targetId: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 1 || separator === value.length - 1) return null;

  const type = value.slice(0, separator);
  const targetId = value.slice(separator + 1);
  if (
    !(["workspace", "view", "element", "boundary", "relationship", "record"] as const).includes(
      type as ReferenceTargetKind,
    )
  ) {
    return null;
  }
  return { type: type as ReferenceTargetKind, targetId };
}

export function buildAgentReference(
  input: AgentReferenceInput,
  origin = window.location.origin,
): StructSmithReference {
  const url = new URL(`/w/${encodeURIComponent(input.workspaceId)}`, origin);
  if (input.viewId) url.searchParams.set("view", input.viewId);
  if (input.type !== "workspace") {
    url.searchParams.set("ref", referenceSearchValue(input.type, input.targetId));
  }

  return {
    version: 1,
    type: input.type,
    workspaceId: input.workspaceId,
    targetId: input.targetId,
    ...(input.label ? { label: input.label } : {}),
    ...(input.viewId ? { viewId: input.viewId } : {}),
    url: url.toString(),
  };
}

/** One line that is easy to paste into a prompt and deterministic to parse. */
export function formatAgentReference(input: AgentReferenceInput, origin?: string): string {
  return `StructSmithRef ${JSON.stringify(buildAgentReference(input, origin))}`;
}
