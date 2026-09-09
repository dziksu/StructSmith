import {
  boundaryClassifications,
  boundaryKinds,
  boundaryLayers,
  changeSources,
  elementKinds,
  elementRoles,
  interactionStyles,
  layoutAlgorithms,
  layoutDirections,
  recordKinds,
  recordStatuses,
  relationshipRoutings,
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
      "The semantic model is the source of truth; views control membership, boundaries, presentation and saved layout without copying model elements.",
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
      layoutAlgorithms,
      relationshipRoutings,
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
        "Create a systemContext view for actors (`kind: person`), the focal software system and external systems.",
        "Create a container view scoped to the focal software system for runtime building blocks.",
        "Seed elementIds when creating the view and include autoLayoutView in the same batch.",
      ],
      relationshipBehavior:
        "Visible relationships are derived from the semantic model. Descendant relationships may be lifted and grouped; explicit view relationship entries only customize visibility and routing.",
      boundaryBehavior:
        "Each view owns its boundary tree. The view boundaryLayer selects which layer is rendered and used by boundary-aware layout; showBoundaries controls rendering without deleting boundaries or memberships. Add elements to the view before assigning them to a boundary. Elements with no boundary in the active layer remain ordinary items in the view; 'Items in view' is a UI grouping, not a boundary object.",
      settings: {
        showFullTitles: "Wrap full element titles instead of truncating them.",
        showDescriptions:
          "Show element descriptions inside cards; automatic layout reserves the additional height.",
        showBoundaries:
          "Show or hide the active boundary layer without changing its tree or memberships.",
        boundaryLayer:
          "Select the deployment, security, compliance, ownership or custom layer rendered on the view.",
        relationshipRouting: "Draw connectors as orthogonal, curved or straight paths.",
        showRelationshipLabels: "Show or hide relationship labels on this view.",
        snapToGrid: "Snap manual element movement to the canvas grid.",
      },
      layouts: {
        persistence:
          "Manual positions, optional sizes, locks and relationship presentation are saved by view_set_layout or setLayout/setViewRelationships operations. Automatic layout overwrites only unlocked element coordinates.",
        dagre:
          "Hierarchical layout and the default choice. It respects LR/TB direction and keeps members of active nested boundaries together.",
        force:
          "Deterministic relationship-driven layout for less hierarchical graphs. Direction is ignored.",
        radial:
          "Places graph-distance rings around rootElementId; when omitted, the most connected element is chosen. Direction is ignored.",
        grid: "Deterministic compact grid. Relationships, rootElementId and direction are ignored.",
      },
    },
    inspection:
      "workspace_inspect always includes view membership, boundary trees and presentation settings. With includeLayouts=false it omits coordinates, sizes, locks, label positions and control points; set includeLayouts=true when changing layout.",
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
