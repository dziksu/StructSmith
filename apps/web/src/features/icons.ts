import {
  Boxes,
  Box,
  Cloud,
  Cog,
  Component,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Network,
  Server,
  Shapes,
  Smartphone,
  User,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ElementKind, ElementRole } from "@structsmith/contracts";

/** Lucide only — no vendor icon packs in the MVP (spec §51). */
const ROLE_ICONS: Partial<Record<ElementRole, LucideIcon>> = {
  frontend: Globe,
  backend: Server,
  service: Server,
  apiGateway: Network,
  database: Database,
  queue: Workflow,
  eventBus: Workflow,
  objectStorage: HardDrive,
  cache: Zap,
  identityProvider: KeyRound,
  externalApi: Cloud,
  mobileApp: Smartphone,
  webApp: Globe,
  worker: Cog,
  serverlessFunction: Zap,
  aiService: Shapes,
  custom: Shapes,
};

const KIND_ICONS: Record<ElementKind, LucideIcon> = {
  person: User,
  softwareSystem: Box,
  container: Boxes,
  component: Component,
  deploymentNode: Layers,
  infrastructureNode: Server,
  custom: Shapes,
};

export function iconFor(kind: ElementKind, role: ElementRole | null): LucideIcon {
  return (role ? ROLE_ICONS[role] : undefined) ?? KIND_ICONS[kind];
}

export { KIND_ICONS, ROLE_ICONS };
