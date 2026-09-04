import type { ArchitectureOperation } from "@structsmith/contracts";
import type { Services } from "@structsmith/domain";

export const EXAMPLE_WORKSPACE_ID = "example-client-portal";

/**
 * The example workspace from spec §47 — it has to show what the tool can do
 * within seconds of opening the app.
 */
export function seedExampleWorkspace(services: Services): string {
  const existing = services.workspaces
    .list()
    .find((workspace) => workspace.id === EXAMPLE_WORKSPACE_ID);
  if (existing) return existing.id;

  services.workspaces.create({
    id: EXAMPLE_WORKSPACE_ID,
    name: "Client Portal",
    description:
      "Example workspace: a customer-facing portal with asynchronous invoice processing.",
    mode: "relaxed",
  });

  const operations: ArchitectureOperation[] = [
    {
      op: "createElement",
      ref: "customer",
      data: {
        id: "customer",
        kind: "person",
        name: "Customer",
        description: "Uses the portal to review invoices and account data.",
      },
    },
    {
      op: "createElement",
      ref: "portal",
      data: {
        id: "client-portal",
        kind: "softwareSystem",
        name: "Client Portal",
        description: "Self-service portal for customers.",
      },
    },
    {
      op: "createElement",
      ref: "web",
      data: {
        id: "web-application",
        kind: "container",
        role: "webApp",
        parentId: "@portal",
        name: "Web Application",
        technology: "React, TypeScript",
        description: "Single page application served to the browser.",
      },
    },
    {
      op: "createElement",
      ref: "api",
      data: {
        id: "backend-api",
        kind: "container",
        role: "apiGateway",
        parentId: "@portal",
        name: "Backend API",
        technology: "Bun, Express",
        description: "REST API backing the portal.",
      },
    },
    {
      op: "createElement",
      ref: "db",
      data: {
        id: "postgresql",
        kind: "container",
        role: "database",
        parentId: "@portal",
        name: "PostgreSQL",
        technology: "PostgreSQL 16",
        description: "Stores accounts, invoices and audit data.",
      },
    },
    {
      op: "createElement",
      ref: "auth0",
      data: {
        id: "auth0",
        kind: "softwareSystem",
        role: "identityProvider",
        external: true,
        name: "Auth0",
        technology: "OIDC",
        description: "Authenticates customers.",
      },
    },
    {
      op: "createElement",
      ref: "erp",
      data: {
        id: "erp",
        kind: "softwareSystem",
        role: "externalApi",
        external: true,
        name: "ERP",
        description: "System of record for invoices.",
      },
    },
    {
      op: "createElement",
      ref: "queue",
      data: {
        id: "invoice-queue",
        kind: "container",
        role: "queue",
        parentId: "@portal",
        name: "Invoice Queue",
        technology: "SQS",
        description: "Buffers invoice processing jobs.",
      },
    },
    {
      op: "createElement",
      ref: "worker",
      data: {
        id: "invoice-worker",
        kind: "container",
        role: "worker",
        parentId: "@portal",
        name: "Invoice Worker",
        technology: "Bun",
        description: "Renders and archives invoice documents.",
      },
    },
    {
      op: "createElement",
      ref: "storage",
      data: {
        id: "object-storage",
        kind: "container",
        role: "objectStorage",
        parentId: "@portal",
        name: "Object Storage",
        technology: "S3",
        description: "Stores generated invoice PDFs.",
      },
    },

    {
      op: "createRelationship",
      data: {
        sourceElementId: "@customer",
        targetElementId: "@web",
        description: "Uses",
        technology: "HTTPS",
        interactionStyle: "sync",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@web",
        targetElementId: "@auth0",
        description: "Authenticates with",
        technology: "OIDC",
        interactionStyle: "sync",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@web",
        targetElementId: "@api",
        description: "Calls",
        technology: "JSON/HTTPS",
        interactionStyle: "sync",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@api",
        targetElementId: "@db",
        description: "Reads from and writes to",
        technology: "SQL",
        interactionStyle: "data",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@api",
        targetElementId: "@erp",
        description: "Fetches invoices from",
        technology: "SOAP",
        interactionStyle: "sync",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@api",
        targetElementId: "@queue",
        description: "Publishes invoice jobs to",
        technology: "SQS",
        interactionStyle: "async",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@queue",
        targetElementId: "@worker",
        description: "Delivers jobs to",
        technology: "SQS",
        interactionStyle: "async",
      },
    },
    {
      op: "createRelationship",
      data: {
        sourceElementId: "@worker",
        targetElementId: "@storage",
        description: "Stores rendered invoices in",
        technology: "S3 API",
        interactionStyle: "data",
      },
    },

    {
      op: "createView",
      ref: "context",
      data: {
        key: "system-context",
        name: "System Context",
        kind: "systemContext",
        scopeElementId: "@portal",
        elementIds: ["@customer", "@portal", "@erp", "@auth0"],
      },
    },
    {
      op: "createView",
      ref: "containers",
      data: {
        key: "containers",
        name: "Containers",
        kind: "container",
        scopeElementId: "@portal",
        elementIds: ["@customer", "@web", "@api", "@db", "@erp", "@auth0"],
      },
    },
    {
      op: "createView",
      ref: "invoices",
      data: {
        key: "invoice-processing",
        name: "Invoice Processing",
        kind: "custom",
        elementIds: ["@api", "@queue", "@worker", "@storage", "@erp"],
      },
    },
    { op: "autoLayoutView", viewId: "@context", direction: "LR" },
    { op: "autoLayoutView", viewId: "@containers", direction: "LR" },
    { op: "autoLayoutView", viewId: "@invoices", direction: "LR" },

    {
      op: "createRecord",
      data: {
        kind: "unknown",
        title: "ERP API protocol",
        contentMd:
          "Is the ERP integration SOAP, REST or a file drop? Needs confirmation from the client.",
        status: "open",
        severity: "medium",
        linkedElementIds: ["@erp"],
      },
    },
    {
      op: "createRecord",
      data: {
        kind: "risk",
        title: "ERP availability may affect invoice processing",
        contentMd:
          "The ERP has no documented SLA. Sustained downtime would stall invoice delivery.",
        status: "open",
        severity: "high",
        linkedElementIds: ["@erp", "@queue"],
      },
    },
    {
      op: "createRecord",
      data: {
        kind: "assumption",
        title: "100k users",
        contentMd: "We assume roughly 100 000 registered users and 5 000 daily active users.",
        status: "open",
        severity: "low",
        linkedElementIds: ["@web"],
      },
    },
  ];

  services.model.applyOperations(
    EXAMPLE_WORKSPACE_ID,
    { operations, label: "Seeded example workspace" },
    "system",
  );

  return EXAMPLE_WORKSPACE_ID;
}
