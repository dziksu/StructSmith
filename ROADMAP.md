# StructSmith roadmap

Make software architecture easier to explore, explain, and evolve, while keeping
StructSmith local, portable, and usable through both the editor and an AI client.

Updated: 8 September 2026. All items below are planned; milestone numbers indicate
delivery order, not release versions or committed dates. Revisit priorities after
each milestone using feedback from onboarding, design reviews, and presales work.

**Starting point**

StructSmith already has a shared architecture model, multiple views, C4 hierarchy,
relationship lifting, linked records, snapshots, validation, and REST/MCP access.
The next improvements should turn those foundations into complete user workflows.

| Horizon | Milestone | User outcome |
| --- | --- | --- |
| Now | 1. Explore architecture | Navigate between levels and inspect dependencies. |
| Now | 2. Switch perspectives | Highlight risk, technology, ownership, and tags. |
| Next | 3. Explain scenarios | Build and present message flows on existing diagrams. |
| Next | 4. Share presentations | Export an interactive architecture explanation that works offline. |
| Next | 5. Review changes | Compare architecture states and preview proposed edits visually. |
| Later | 6. Save proposals | Keep, review, and apply named change proposals. |

Estimates assume one developer familiar with the repository and include focused
verification, translations, and required migrations. They exclude review delays
and subsequent scope additions. Confidence is lower for flows, export packaging,
and proposals. Re-estimate each milestone when implementation begins.

**Milestone 1 — Explore architecture**

An architect should be able to move from a system to its containers and components,
understand what connects to each object, and return without losing their place.

- [ ] **NAV-1: Open details from a diagram.** Add an explicit action on systems
  and containers, with double-click as an optional shortcut. Open an existing
  scoped view; show a chooser when several match.
- [ ] **NAV-2: Preserve navigation context.** Add scope breadcrumbs and back
  navigation that restores the previous diagram, viewport, and selection.
- [ ] **NAV-3: Create useful scoped views.** When no detail view exists, offer
  creation with relevant children and connected context. Keep an empty-view
  option and respect the workspace's modelling rules.
- [ ] **NAV-4: Explain objects on the canvas.** Display a compact responsibility
  description using existing metadata, with full details in the inspector.
- [ ] **DEP-1: Inspect connections.** Show incoming/outgoing relationships and
  distinguish direct connections from connections involving descendants.
- [ ] **DEP-2: Explore dependencies across the model.** Add a focused one-hop
  dependency view and a list of diagrams containing the selected element.

Completion criteria: a user can reach an existing component view from its system
in two drill-in actions, return to the same framing, and find a dependency absent
from the original diagram. Browsing creates no model changes or duplicate views.

Implementation dependency: retain every underlying relationship ID when several
connections are represented by one diagram edge. Use shared domain queries for
dependency inspection and recommended view contents so REST, MCP, and the editor
agree. Start with one-hop exploration; add deeper traversal after the basic
workflow is useful.

**Milestone 2 — Switch perspectives**

An architect should be able to discuss risk or technology using the diagram they
already have, with a clear legend and without changing its contents.

- [ ] **OVR-1: Add built-in overlays.** Support internal/external ownership,
  technology, existing tags, and risk severity.
- [ ] **OVR-2: Reuse linked records.** Derive risk from active risk records;
  resolving a risk updates its presentation automatically. Show missing
  classification explicitly.
- [ ] **OVR-3: Highlight and focus.** Add labelled legends, counts, dimming of
  non-matches, and a clear reset action. Define whether counts represent objects
  or relationships.
- [ ] **OVR-4: Keep views stable.** Switching overlays preserves layout and view
  membership. Use text labels alongside colour and preserve selection visibility.

Completion criteria: a user switches a diagram to Risk, identifies an affected
element, resolves the linked record, and sees the overlay update. Resetting the
overlay restores the original presentation without writing layout or model edits.

Implementation dependency: keep active overlays in presentation/navigation state
and apply display filtering without rewriting persisted visibility. Grouped custom
tags and saved perspectives remain follow-up work beyond this milestone.

**First delivery target: milestones 1 and 2**

Deliver one complete route through the product: open a system's detail view,
inspect a dependency, and switch to a risk overlay. The estimated combined effort
is 11–19 engineer-days. Review this experience with users before expanding scope.

Suggested implementation order: add navigation, improve view creation and
descriptions, preserve relationship identities for dependency queries, then add
the overlay controls. Each change should remain independently reviewable.

**Milestone 3 — Explain scenarios**

An architect should be able to explain authentication, checkout, or invoice
processing step by step using the same objects and relationships as the model.

- [ ] **FLOW-1: Store named flows.** Associate a flow with a primary diagram and
  an ordered sequence of message, process, and note steps.
- [ ] **FLOW-2: Author steps from selections.** Use a selected object or
  relationship to create a step, add explanations, and reorder the sequence.
- [ ] **FLOW-3: Present the sequence.** Add previous/next controls, keyboard
  navigation, jump-to-step, and readable text alongside highlighted connections.
- [ ] **FLOW-4: Support responses.** Let a step reverse the displayed message
  direction while retaining the underlying relationship's meaning.
- [ ] **FLOW-5: Make flows portable and accessible to AI.** Include flows in
  REST/MCP, validation, copyable references, native export/import, and snapshots.

Completion criteria: a scenario can use the same connection more than once,
including a response; it survives export/import and snapshot restore; playback
does not mutate the architecture; and removing a referenced object or connection
produces an explicit repair or cascade outcome.

Implementation dependencies: milestones 1–2 supply relationship identity and
highlighting behaviour. Persist canonical references rather than derived diagram
edge IDs. Explain when a step requires a deeper view because its endpoints are
collapsed into one visible object. Add document compatibility and deletion rules
alongside persistence. Alternate paths, parallel paths, nested flows, and sequence
diagram export are subsequent enhancements.

**Milestone 4 — Share presentations**

A consultant or developer should be able to give someone an interactive
architecture explanation they can open without installing StructSmith.

- [ ] **SHARE-1: Add presentation mode.** Reduce editing controls while retaining
  navigation, object details, overlays, and flow playback.
- [ ] **SHARE-2: Export an offline viewer.** Package selected diagrams, required
  model data, and a viewer into a self-contained HTML file or folder that can be
  opened directly in a browser.
- [ ] **SHARE-3: Choose the shared content.** Let the author select included
  records and properties. Package only the selected content and required
  dependencies; show the export's source revision and date.
- [ ] **SHARE-4: Preserve the entry point.** Open the exported presentation at
  the intended diagram, overlay, and flow step.

Completion criteria: with networking unavailable, a recipient can navigate the
export, inspect included details, and play its scenario. Unselected records and
unrelated workspace data are absent from the package, and the viewer issues no
authoring requests.

Implementation dependencies: reuse the navigation and flow player from earlier
milestones. Resolve packaging, browser file-loading, and data-selection behaviour
with a small export prototype first. Hosted live links and viewer permissions are
a separate later investment.

**Milestone 5 — Review changes**

An architect should be able to see what changes between two architecture states
and inspect proposed operations visually before applying them.

- [ ] **REV-1: Compare snapshots and current state.** Show added, removed, and
  changed elements, relationships, and records.
- [ ] **REV-2: Distinguish architecture and diagram edits.** Present layout and
  view-membership changes separately from changes to the model's meaning.
- [ ] **REV-3: Render operation previews.** Extend the existing transactional
  preview to provide a candidate model or canonical diff that the UI can display.
- [ ] **REV-4: Show impact and validation.** List affected diagrams, records,
  flows, and validation findings alongside the proposed changes.
- [ ] **REV-5: Apply the reviewed change safely.** Require the expected revision,
  validate within the final transaction, retain an undo snapshot, and emit the
  usual activity and workspace events.

Completion criteria: moving a node appears as a layout change; proposed deletions
show their affected references; preview leaves the live model untouched; and
intervening edits cause a stale preview to be rejected and refreshed before apply.

Implementation dependency: establish stable identities or an explicit identity
mapping between preview and application. The existing preview does not reserve
generated IDs. Historical documents need compatibility handling as the model
format evolves. Snapshot comparison can begin independently of presentation work,
but its final coverage must include any newly introduced flow entities.

**Milestone 6 — Save proposals**

An architect should be able to save a proposed change, revisit its rationale and
impact, and apply it after review without losing the current design.

- [ ] **PROP-1: Persist named proposals.** Store a title, rationale, immutable
  base document/revision, operation set, and review state.
- [ ] **PROP-2: Reopen and inspect.** Reuse visual comparison and impact analysis
  to review a proposal across all affected diagrams.
- [ ] **PROP-3: Handle stale bases explicitly.** Require refreshing or rebasing
  and another review when the live model has changed.
- [ ] **PROP-4: Preserve proposal history.** Retain the base independently of
  rolling snapshots and record application or rejection outcomes.

Completion criteria: proposals survive restart, rejected proposals leave the live
model unchanged, snapshot cleanup cannot remove an active proposal's base, and
stale proposals cannot overwrite intervening edits.

Implementation dependency: milestone 5 must provide reliable diff, preview, and
guarded application. Start with operation-based proposals. Editable branches,
selective merging, and three-way conflict resolution require a separate design
spike covering object identity, deletion, and rebasing.

**Follow-up backlog — prioritize using observed needs**

| Area | Candidate improvements | Revisit when |
| --- | --- | --- |
| Documentation | Decision templates, readable Markdown, record-to-element navigation, decision timeline | Users struggle to capture or find design rationale. |
| Source links | Labelled documentation/repository links, optional verification metadata | Users repeatedly leave the tool to locate implementation context. |
| Metadata | Custom tag groups, saved perspectives, lifecycle status, separate team ownership | Built-in overlays cannot express recurring questions. |
| Model scale | Grouped views, model-wide tables, deeper dependency traversal, performance improvements | Larger workspaces expose navigation or responsiveness limits. |
| Interoperability | Architecture DSL import/export, OpenAPI/Terraform/Kubernetes importers, sequence exports | Real customer files and mapping requirements are available. |
| Visual assets | Optional vendor icon packs and richer technology presentation | Role-based icons are insufficient for actual diagrams. |
| Collaboration | Scoped viewer access, hosted share links, comments, presence, team permissions | Shared deployments become a repeated requirement. |
| Advanced scenarios | Alternate/parallel paths, linked flows, reusable scenario sections | Linear flows no longer explain common user stories. |

**Completion standards for every milestone**

- Preserve the semantic model as the source of truth and keep layout within views.
- Define shared contracts once and put domain queries/mutations behind both REST
  and MCP. Keep temporary browsing and playback state out of architecture writes.
- When adding persisted entities, update migrations, validation, document capture,
  restore, import remapping, and export compatibility together.
- Support keyboard operation, readable labels, English and Polish, and light/dark
  themes. Verify new visual behaviour on a real diagram.
- Test meaningful invariants: reference integrity, persistence round-trips,
  revision conflicts, deletion behaviour, and exported data boundaries.
- Update documentation and examples, and complete the repository's required
  checks before shipping implementation changes.

**How to evaluate progress**

Use repeatable tasks on a representative workspace: locate a component, identify
incoming dependencies, explain one scenario, share it, and review a proposed
change. Measure completion time, navigation mistakes, unanswered questions, and
extra diagrams needed. Establish a baseline before claiming improvements; keep
these evaluations local unless the user explicitly chooses to share results.

The next implementation task is **NAV-1: open an existing scoped detail view from
a system or container**, including a chooser for multiple matches and a clear
empty state. Ship that usable slice, then extend it through the first milestone.
