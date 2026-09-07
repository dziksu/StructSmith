import { z } from "zod";

export const referenceTargetKinds = [
  "workspace",
  "view",
  "element",
  "relationship",
  "record",
] as const;

export const ReferenceTargetKindSchema = z.enum(referenceTargetKinds);
export type ReferenceTargetKind = z.infer<typeof ReferenceTargetKindSchema>;

export interface StructSmithReference {
  version: 1;
  type: ReferenceTargetKind;
  workspaceId: string;
  targetId: string;
  label?: string;
  viewId?: string;
  url: string;
}
