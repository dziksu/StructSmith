import {
  boundaryClassifications,
  boundaryKinds,
  boundaryLayers,
  changeSources,
  elementKinds,
  elementRoles,
  interactionStyles,
  layoutDirections,
  recordKinds,
  recordStatuses,
  severities,
  viewKinds,
  workspaceModes,
} from "@structsmith/contracts";

export const OPERATION_KINDS = [
  "createElement",
  "updateElement",
  "deleteElement",
  "createBoundary",
  "updateBoundary",
  "deleteBoundary",
  "setBoundaryMembers",
  "createRelationship",
  "updateRelationship",
  "deleteRelationship",
  "createView",
  "updateView",
  "deleteView",
  "setViewElements",
  "setViewRelationships",
  "setLayout",
  "autoLayoutView",
  "createRecord",
  "updateRecord",
  "deleteRecord",
] as const;

/** Compact, machine-readable guidance so clients never need repository code. */
export function modelingGuide() {
  return {
    version: 1,
    startHere: [
      "Call workspace_list to resolve the target workspace id.",
      "Call workspace_inspect before planning a change.",
      "When a prompt contains a StructSmithRef payload, call reference_resolve with its workspaceId, type and targetId.",
      "Use the tool input schemas and this guide; do not inspect StructSmith source code.",
      "For multi-entity changes call model_preview_operations, then model_apply_operations.",
      "Finish with model_validate and inspect the affected views.",
    ],
    principles: [
      "The semantic model is the source of truth; views only control membership and layout.",
      "Model each relationship once at the most specific meaningful C4 level.",
      "When a view hides descendants, StructSmith lifts and groups their relationships onto visible ancestors automatically. Do not add duplicate system-level relationships for a context view.",
      "Containers belong to software systems; components belong to containers.",
      "Use external=true for systems outside the modeled ownership boundary.",
      "Records capture assumptions, risks, unknowns, requirements, decisions and notes; they are not diagram nodes.",
      "Boundaries belong to a view. They group that view's elements by deployment, security, compliance or ownership semantics; they are not model elements or relationship endpoints.",
      "The same model element can have different boundary membership in different views. Within one view it can belong to at most one boundary in a layer.",
    ],
    enums: {
      elementKinds,
      elementRoles,
      interactionStyles,
      viewKinds,
      recordKinds,
      recordStatuses,
      severities,
      workspaceModes,
      changeSources,
      layoutDirections,
      boundaryKinds,
      boundaryLayers,
      boundaryClassifications,
      operationKinds: OPERATION_KINDS,
    },
    references: {
      copiedReferences:
        "The UI copies one-line StructSmithRef JSON. Resolve it with reference_resolve; its url also deep-links to the target in the editor.",
      syntax: "Assign ref on a create operation and use @ref in later id fields in the same batch.",
      example: [
        { op: "createElement", ref: "api", data: { kind: "container", name: "API" } },
        {
          op: "createRelationship",
          data: {
            sourceElementId: "existing-client-id",
            targetElementId: "@api",
            interactionStyle: "sync",
          },
        },
      ],
    },
    views: {
      recommended: [
        "Create a systemContext view for people, the focal software system and external systems.",
        "Create a container view scoped to the focal software system for runtime building blocks.",
        "Seed elementIds when creating the view and include autoLayoutView in the same batch.",
      ],
      relationshipBehavior:
        "Visible relationships are derived from the semantic model. Descendant relationships may be lifted and grouped; explicit view relationship entries only customize visibility and routing.",
      boundaryBehavior:
        "Each view owns its boundary tree. The view boundaryLayer selects which layer is rendered and showBoundaries controls its visibility. Add elements to the view before assigning them to one of its boundaries.",
    },
    concurrency: {
      expectedRevision:
        "Optional optimistic guard. Use the revision returned by workspace_inspect when overwriting or deleting existing data.",
      conflictRecovery:
        "On a revision conflict, inspect again, reconcile the new state, and retry. Omit the guard only when merging onto the latest state is safe and intended.",
      preview:
        "Preview runs the real engine and validator in a rolled-back transaction. Preview ids are illustrative and must not be reused outside the batch.",
    },
    limits: { operationsPerBatch: 500, idLength: 64, nameLength: 200 },
  } as const;
}
