import { z } from "zod";

export const elementKinds = [
  "person",
  "softwareSystem",
  "container",
  "component",
  "deploymentNode",
  "infrastructureNode",
  "custom",
] as const;
export const ElementKindSchema = z.enum(elementKinds);
export type ElementKind = z.infer<typeof ElementKindSchema>;

export const elementRoles = [
  "frontend",
  "backend",
  "service",
  "apiGateway",
  "database",
  "queue",
  "eventBus",
  "objectStorage",
  "cache",
  "identityProvider",
  "externalApi",
  "mobileApp",
  "webApp",
  "worker",
  "serverlessFunction",
  "aiService",
  "custom",
] as const;
export const ElementRoleSchema = z.enum(elementRoles);
export type ElementRole = z.infer<typeof ElementRoleSchema>;

export const interactionStyles = [
  "sync",
  "async",
  "event",
  "data",
  "dependency",
  "custom",
] as const;
export const InteractionStyleSchema = z.enum(interactionStyles);
export type InteractionStyle = z.infer<typeof InteractionStyleSchema>;

export const viewKinds = [
  "landscape",
  "systemContext",
  "container",
  "component",
  "deployment",
  "custom",
] as const;
export const ViewKindSchema = z.enum(viewKinds);
export type ViewKind = z.infer<typeof ViewKindSchema>;

export const recordKinds = [
  "assumption",
  "risk",
  "unknown",
  "requirement",
  "decision",
  "note",
] as const;
export const RecordKindSchema = z.enum(recordKinds);
export type RecordKind = z.infer<typeof RecordKindSchema>;

export const recordStatuses = ["open", "confirmed", "resolved", "rejected"] as const;
export const RecordStatusSchema = z.enum(recordStatuses);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const severities = ["low", "medium", "high", "critical"] as const;
export const SeveritySchema = z.enum(severities);
export type Severity = z.infer<typeof SeveritySchema>;

export const workspaceModes = ["strict", "relaxed"] as const;
export const WorkspaceModeSchema = z.enum(workspaceModes);
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;

export const changeSources = ["ui", "mcp", "system", "import"] as const;
export const ChangeSourceSchema = z.enum(changeSources);
export type ChangeSource = z.infer<typeof ChangeSourceSchema>;

export const issueLevels = ["error", "warning", "info"] as const;
export const IssueLevelSchema = z.enum(issueLevels);
export type IssueLevel = z.infer<typeof IssueLevelSchema>;

export const layoutDirections = ["LR", "TB"] as const;
export const LayoutDirectionSchema = z.enum(layoutDirections);
export type LayoutDirection = z.infer<typeof LayoutDirectionSchema>;
