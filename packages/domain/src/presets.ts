import type { ElementKind, ElementRole } from "@structsmith/contracts";

/**
 * Palette presets (spec §31). A preset is nothing more than a convenient
 * `kind` + `role` pair — the semantic model stays the source of truth.
 */
export interface ElementPreset {
  id: string;
  /** i18n key used by the web UI; the raw label is the English fallback. */
  label: string;
  kind: ElementKind;
  role: ElementRole | null;
  technology?: string;
  external?: boolean;
  icon: string;
}

export const presets: readonly ElementPreset[] = [
  { id: "person", label: "Person", kind: "person", role: null, icon: "User" },
  {
    id: "softwareSystem",
    label: "Software System",
    kind: "softwareSystem",
    role: null,
    icon: "Box",
  },
  { id: "webApp", label: "Web App", kind: "container", role: "webApp", icon: "Globe" },
  {
    id: "mobileApp",
    label: "Mobile App",
    kind: "container",
    role: "mobileApp",
    icon: "Smartphone",
  },
  { id: "api", label: "API", kind: "container", role: "apiGateway", icon: "Network" },
  { id: "service", label: "Service", kind: "container", role: "service", icon: "Server" },
  { id: "database", label: "Database", kind: "container", role: "database", icon: "Database" },
  { id: "queue", label: "Queue", kind: "container", role: "queue", icon: "Workflow" },
  { id: "worker", label: "Worker", kind: "container", role: "worker", icon: "Cog" },
  {
    id: "objectStorage",
    label: "Object Storage",
    kind: "container",
    role: "objectStorage",
    icon: "HardDrive",
  },
  { id: "cache", label: "Cache", kind: "container", role: "cache", icon: "Zap" },
  {
    id: "identityProvider",
    label: "Identity Provider",
    kind: "softwareSystem",
    role: "identityProvider",
    external: true,
    icon: "KeyRound",
  },
  {
    id: "externalApi",
    label: "External API",
    kind: "softwareSystem",
    role: "externalApi",
    external: true,
    icon: "Cloud",
  },
  { id: "component", label: "Component", kind: "component", role: null, icon: "Component" },
  { id: "custom", label: "Custom", kind: "custom", role: "custom", icon: "Shapes" },
];
