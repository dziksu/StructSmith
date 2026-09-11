import type {
  ArchitectureBoundary,
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ElementKind,
  ElementRole,
  InteractionStyle,
  UpdateBoundaryInput,
  UpdateElementInput,
  UpdateRelationshipInput,
  ViewDetail,
} from "@structsmith/contracts";
import { elementKinds, elementRoles, interactionStyles } from "@structsmith/contracts";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApplyOperations } from "@/hooks/useApi";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { iconFor } from "../icons";
import { CopyReferenceButton } from "../reference/CopyReferenceButton";
import { PropertyEditor } from "./PropertyEditor";
import { TagEditor } from "./TagEditor";

interface InspectorProps {
  workspaceId: string;
  elements: readonly ArchitectureElement[];
  boundaries: readonly ArchitectureBoundary[];
  relationships: readonly ArchitectureRelationship[];
  records: readonly ArchitectureRecord[];
  view: ViewDetail | null;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    {children}
  </div>
);

export function Inspector({
  workspaceId,
  elements,
  boundaries,
  relationships,
  records,
  view,
}: InspectorProps) {
  const { t } = useTranslation();
  const selection = useEditorStore((state) => state.selection);
  const applyOperations = useApplyOperations(workspaceId);

  const element =
    selection.type === "element" ? elements.find((item) => item.id === selection.id) : undefined;
  const relationship =
    selection.type === "relationship"
      ? relationships.find((item) => item.id === selection.id)
      : undefined;
  const boundary =
    selection.type === "boundary" ? boundaries.find((item) => item.id === selection.id) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-8 items-center border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("inspector.title")}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3 pb-10">
          {element && (
            <ElementInspector
              key={element.id}
              element={element}
              elements={elements}
              boundaries={boundaries}
              boundaryLayer={view?.settings.boundaryLayer ?? "deployment"}
              records={records}
              workspaceId={workspaceId}
              viewId={view?.id}
              onPatch={(data, label) =>
                applyOperations.mutate({
                  label,
                  operations: [{ op: "updateElement", elementId: element.id, data }],
                })
              }
              onBoundaryChange={(nextBoundaryId) => {
                const layer = view?.settings.boundaryLayer ?? "deployment";
                const current = boundaries.find(
                  (candidate) =>
                    candidate.layer === layer && candidate.elementIds.includes(element.id),
                );
                if (!nextBoundaryId && !current) return;
                applyOperations.mutate({
                  label: t("boundaries.membershipChanged"),
                  operations: nextBoundaryId
                    ? [
                        ...(view && !view.elements.some((entry) => entry.elementId === element.id)
                          ? [
                              {
                                op: "setViewElements" as const,
                                viewId: view.id,
                                elementIds: [element.id],
                                mode: "add" as const,
                              },
                              {
                                op: "setLayout" as const,
                                viewId: view.id,
                                entries: [{ elementId: element.id, hidden: false }],
                              },
                            ]
                          : []),
                        {
                          op: "setBoundaryMembers",
                          boundaryId: nextBoundaryId,
                          elementIds: [element.id],
                          mode: "add",
                        },
                      ]
                    : current
                      ? [
                          {
                            op: "setBoundaryMembers",
                            boundaryId: current.id,
                            elementIds: [element.id],
                            mode: "remove",
                          },
                        ]
                      : [],
                });
              }}
            />
          )}

          {relationship && (
            <RelationshipInspector
              key={relationship.id}
              relationship={relationship}
              elements={elements.filter((element) =>
                view?.elements.some((entry) => entry.elementId === element.id),
              )}
              workspaceId={workspaceId}
              viewId={view?.id}
              onPatch={(data, label) =>
                applyOperations.mutate({
                  label,
                  operations: [{ op: "updateRelationship", relationshipId: relationship.id, data }],
                })
              }
            />
          )}

          {boundary && (
            <BoundaryInspector
              key={boundary.id}
              boundary={boundary}
              boundaries={boundaries}
              elements={elements}
              workspaceId={workspaceId}
              viewId={view?.id}
              onPatch={(data) =>
                applyOperations.mutate({
                  label: t("boundaries.updated"),
                  operations: [{ op: "updateBoundary", boundaryId: boundary.id, data }],
                })
              }
              onMemberChange={(elementId, member) =>
                applyOperations.mutate({
                  label: t("boundaries.membershipChanged"),
                  operations: [
                    {
                      op: "setBoundaryMembers",
                      boundaryId: boundary.id,
                      elementIds: [elementId],
                      mode: member ? "add" : "remove",
                    },
                  ],
                })
              }
            />
          )}

          {selection.type === "elements" && (
            <p className="text-xs text-muted-foreground">
              {t("inspector.multipleSelected", { count: selection.ids.length })}
            </p>
          )}

          {!element && !relationship && !boundary && selection.type !== "elements" && view && (
            <ViewInspector
              key={view.id}
              view={view}
              workspaceId={workspaceId}
              onPatch={(settings) =>
                applyOperations.mutate({
                  label: settings.autoLayoutAlgorithm
                    ? t("inspector.layoutAlgorithm")
                    : settings.autoLayoutDirection
                      ? t("inspector.layoutDirection")
                      : t("inspector.viewSettings"),
                  operations: [
                    { op: "updateView", viewId: view.id, data: { settings } },
                    ...(settings.autoLayoutDirection || settings.autoLayoutAlgorithm
                      ? [
                          {
                            op: "autoLayoutView" as const,
                            viewId: view.id,
                            direction:
                              settings.autoLayoutDirection ?? view.settings.autoLayoutDirection,
                            algorithm:
                              settings.autoLayoutAlgorithm ?? view.settings.autoLayoutAlgorithm,
                          },
                        ]
                      : []),
                  ],
                })
              }
            />
          )}

          {!element && !relationship && !boundary && !view && (
            <p className="text-xs text-muted-foreground">{t("inspector.nothingSelected")}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function BoundaryInspector({
  boundary,
  boundaries,
  elements,
  workspaceId,
  viewId,
  onPatch,
  onMemberChange,
}: {
  boundary: ArchitectureBoundary;
  boundaries: readonly ArchitectureBoundary[];
  elements: readonly ArchitectureElement[];
  workspaceId: string;
  viewId?: string;
  onPatch: (data: UpdateBoundaryInput) => void;
  onMemberChange: (elementId: string, member: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(boundary.name);
  const [description, setDescription] = useState(boundary.description ?? "");
  const [memberFilter, setMemberFilter] = useState("");
  const memberIds = new Set(boundary.elementIds);
  const visibleElements = elements
    .filter((element) => element.name.toLowerCase().includes(memberFilter.trim().toLowerCase()))
    .sort((left, right) => {
      const membershipDifference = Number(memberIds.has(right.id)) - Number(memberIds.has(left.id));
      return membershipDifference || left.name.localeCompare(right.name);
    });
  const commitName = () => {
    const value = name.trim();
    if (value && value !== boundary.name) onPatch({ name: value });
  };
  const commitDescription = () => {
    const value = description.trim() || null;
    if (value !== boundary.description) onPatch({ description: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t("boundaries.title")}</Badge>
          <CopyReferenceButton
            className="ml-auto"
            reference={{
              type: "boundary",
              workspaceId,
              targetId: boundary.id,
              label: boundary.name,
              viewId,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {boundary.elementIds.length} {t("boundaries.members")}
        </p>
      </div>
      <Field label={t("common.name")}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => event.key === "Enter" && commitName()}
        />
      </Field>
      <Field label={t("common.description")}>
        <Textarea
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={commitDescription}
        />
      </Field>
      <Field label={t("boundaries.kindLabel")}>
        <Select
          value={boundary.kind}
          onValueChange={(kind) => onPatch({ kind: kind as ArchitectureBoundary["kind"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                "environment",
                "region",
                "availabilityZone",
                "networkZone",
                "trustZone",
                "complianceScope",
                "custom",
              ] as const
            ).map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`boundaries.kind.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("boundaries.classificationLabel")}>
        <Select
          value={boundary.classification ?? "none"}
          onValueChange={(classification) =>
            onPatch({
              classification:
                classification === "none"
                  ? null
                  : (classification as ArchitectureBoundary["classification"]),
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {(["public", "restricted", "private"] as const).map((classification) => (
              <SelectItem key={classification} value={classification}>
                {t(`boundaries.classification.${classification}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("boundaries.layerLabel")}>
        <Select
          value={boundary.layer}
          onValueChange={(layer) =>
            onPatch({
              layer: layer as ArchitectureBoundary["layer"],
              parentBoundaryId:
                boundary.parentBoundaryId &&
                boundaries.find((candidate) => candidate.id === boundary.parentBoundaryId)
                  ?.layer === layer
                  ? boundary.parentBoundaryId
                  : null,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["deployment", "security", "compliance", "ownership", "custom"] as const).map(
              (layer) => (
                <SelectItem key={layer} value={layer}>
                  {t(`boundaries.layer.${layer}`)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("boundaries.parent")}>
        <Select
          value={boundary.parentBoundaryId ?? "none"}
          onValueChange={(parentBoundaryId) =>
            onPatch({ parentBoundaryId: parentBoundaryId === "none" ? null : parentBoundaryId })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {boundaries
              .filter(
                (candidate) => candidate.id !== boundary.id && candidate.layer === boundary.layer,
              )
              .map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("boundaries.memberElements")}>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("boundaries.membershipHint")}
        </p>
        <Input
          value={memberFilter}
          onChange={(event) => setMemberFilter(event.target.value)}
          placeholder={t("boundaries.filterElements")}
          className="h-7"
        />
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1">
          {visibleElements.map((element) => {
            const member = memberIds.has(element.id);
            const assignedElsewhere = boundaries.find(
              (candidate) =>
                candidate.id !== boundary.id &&
                candidate.layer === boundary.layer &&
                candidate.elementIds.includes(element.id),
            );
            return (
              <div
                key={element.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
              >
                <Switch
                  checked={member}
                  onCheckedChange={(checked) => onMemberChange(element.id, checked)}
                  aria-label={`${member ? t("boundaries.removeMember") : t("boundaries.addMember")} ${element.name}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{element.name}</span>
                  {assignedElsewhere && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {assignedElsewhere.name}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

/* ---------------------------------- element --------------------------------- */

function ElementInspector({
  element,
  elements,
  boundaries,
  boundaryLayer,
  records,
  workspaceId,
  viewId,
  onPatch,
  onBoundaryChange,
}: {
  element: ArchitectureElement;
  elements: readonly ArchitectureElement[];
  boundaries: readonly ArchitectureBoundary[];
  boundaryLayer: ArchitectureBoundary["layer"];
  records: readonly ArchitectureRecord[];
  workspaceId: string;
  viewId?: string;
  onPatch: (data: UpdateElementInput, label: string) => void;
  onBoundaryChange: (boundaryId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(element.name);
  const [description, setDescription] = useState(element.description ?? "");
  const [technology, setTechnology] = useState(element.technology ?? "");

  useEffect(() => {
    setName(element.name);
    setDescription(element.description ?? "");
    setTechnology(element.technology ?? "");
  }, [element.name, element.description, element.technology]);

  const debouncedPatch = useDebouncedCallback(
    (data: UpdateElementInput) => onPatch(data, `Updated ${element.name}`),
    600,
  );

  const Icon = iconFor(element.kind, element.role);
  const linked = useMemo(
    () => records.filter((record) => record.linkedElementIds.includes(element.id)),
    [records, element.id],
  );
  const parents = elements.filter((candidate) => candidate.id !== element.id);
  const layerBoundaries = boundaries.filter((boundary) => boundary.layer === boundaryLayer);
  const currentBoundary = layerBoundaries.find((boundary) =>
    boundary.elementIds.includes(element.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Badge variant="primary">{t("inspector.element")}</Badge>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{element.id}</span>
        <CopyReferenceButton
          className="ml-auto"
          reference={{
            type: "element",
            workspaceId,
            targetId: element.id,
            label: element.name,
            viewId,
          }}
        />
      </div>

      <Field label={t("common.name")}>
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (event.target.value.trim()) debouncedPatch({ name: event.target.value.trim() });
          }}
        />
      </Field>

      <Field label={t("common.description")}>
        <Textarea
          value={description}
          rows={3}
          onChange={(event) => {
            setDescription(event.target.value);
            debouncedPatch({ description: event.target.value || null });
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("inspector.kind")}>
          <Select
            value={element.kind}
            onValueChange={(value) => onPatch({ kind: value as ElementKind }, "Changed kind")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elementKinds.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("inspector.role")}>
          <Select
            value={element.role ?? "none"}
            onValueChange={(value) =>
              onPatch({ role: value === "none" ? null : (value as ElementRole) }, "Changed role")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {elementRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {t(`roles.${role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t("common.technology")}>
        <Input
          value={technology}
          onChange={(event) => {
            setTechnology(event.target.value);
            debouncedPatch({ technology: event.target.value || null });
          }}
        />
      </Field>

      <Field label={t("inspector.parent")}>
        <Select
          value={element.parentId ?? "none"}
          onValueChange={(value) =>
            onPatch({ parentId: value === "none" ? null : value }, "Changed parent")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.none")}</SelectItem>
            {parents.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {layerBoundaries.length > 0 && (
        <Field label={t("boundaries.membership")}>
          <Select
            value={currentBoundary?.id ?? "none"}
            onValueChange={(value) => onBoundaryChange(value === "none" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {layerBoundaries.map((boundary) => (
                <SelectItem key={boundary.id} value={boundary.id}>
                  {boundary.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="space-y-1.5">
        <Label>{t("inspector.ownership")}</Label>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1">
          <button
            type="button"
            aria-pressed={!element.external}
            onClick={() => onPatch({ external: false }, "Changed ownership to internal")}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors",
              !element.external
                ? "bg-ownership-internal/15 text-ownership-internal ring-1 ring-inset ring-ownership-internal/45"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-sm bg-ownership-internal" />
            {t("inspector.internal")}
          </button>
          <button
            type="button"
            aria-pressed={element.external}
            onClick={() => onPatch({ external: true }, "Changed ownership to external")}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors",
              element.external
                ? "bg-ownership-external/15 text-ownership-external ring-1 ring-inset ring-ownership-external/45"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-sm border border-dashed border-ownership-external bg-ownership-external/15" />
            {t("inspector.external")}
          </button>
        </div>
      </div>

      <Field label={t("common.tags")}>
        <TagEditor tags={element.tags} onChange={(tags) => onPatch({ tags }, "Updated tags")} />
      </Field>

      <Field label={t("common.properties")}>
        <PropertyEditor
          properties={element.properties}
          onChange={(properties) => onPatch({ properties }, "Updated properties")}
        />
      </Field>

      {linked.length > 0 && (
        <Field label={t("inspector.linkedRecords")}>
          <div className="space-y-1">
            {linked.map((record) => (
              <div
                key={record.id}
                className="rounded border border-border/60 px-2 py-1 text-[12px]"
              >
                <Badge variant="outline">{t(`presales.kinds.${record.kind}`)}</Badge>
                <div className="mt-1 leading-snug">{record.title}</div>
              </div>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}

/* ------------------------------- relationship ------------------------------- */

function RelationshipInspector({
  relationship,
  elements,
  workspaceId,
  viewId,
  onPatch,
}: {
  relationship: ArchitectureRelationship;
  elements: readonly ArchitectureElement[];
  workspaceId: string;
  viewId?: string;
  onPatch: (data: UpdateRelationshipInput, label: string) => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(relationship.description ?? "");
  const [technology, setTechnology] = useState(relationship.technology ?? "");

  useEffect(() => {
    setDescription(relationship.description ?? "");
    setTechnology(relationship.technology ?? "");
  }, [relationship.description, relationship.technology]);

  const debouncedPatch = useDebouncedCallback(
    (data: UpdateRelationshipInput) => onPatch(data, "Updated relationship"),
    600,
  );

  const nameOf = (id: string): string => elements.find((element) => element.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="primary">{t("inspector.relationship")}</Badge>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {relationship.id}
        </span>
        <CopyReferenceButton
          className="ml-auto"
          reference={{
            type: "relationship",
            workspaceId,
            targetId: relationship.id,
            label: `${nameOf(relationship.sourceElementId)} → ${nameOf(relationship.targetElementId)}`,
            viewId,
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("inspector.source")}>
          <Select
            value={relationship.sourceElementId}
            onValueChange={(value) => onPatch({ sourceElementId: value }, "Changed source")}
          >
            <SelectTrigger>
              <SelectValue>{nameOf(relationship.sourceElementId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {elements.map((element) => (
                <SelectItem key={element.id} value={element.id}>
                  {element.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("inspector.target")}>
          <Select
            value={relationship.targetElementId}
            onValueChange={(value) => onPatch({ targetElementId: value }, "Changed target")}
          >
            <SelectTrigger>
              <SelectValue>{nameOf(relationship.targetElementId)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {elements.map((element) => (
                <SelectItem key={element.id} value={element.id}>
                  {element.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t("common.description")}>
        <Textarea
          autoFocus
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            debouncedPatch({ description: event.target.value || null });
          }}
        />
      </Field>

      <Field label={t("common.technology")}>
        <Input
          value={technology}
          onChange={(event) => {
            setTechnology(event.target.value);
            debouncedPatch({ technology: event.target.value || null });
          }}
        />
      </Field>

      <Field label={t("inspector.interactionStyle")}>
        <Select
          value={relationship.interactionStyle}
          onValueChange={(value) =>
            onPatch({ interactionStyle: value as InteractionStyle }, "Changed interaction style")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {interactionStyles.map((style) => (
              <SelectItem key={style} value={style}>
                {t(`interactionStyles.${style}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("common.tags")}>
        <TagEditor
          tags={relationship.tags}
          onChange={(tags) => onPatch({ tags }, "Updated tags")}
        />
      </Field>

      <Field label={t("common.properties")}>
        <PropertyEditor
          properties={relationship.properties}
          onChange={(properties) => onPatch({ properties }, "Updated properties")}
        />
      </Field>
    </div>
  );
}

/* ----------------------------------- view ----------------------------------- */

function ViewInspector({
  view,
  workspaceId,
  onPatch,
}: {
  view: ViewDetail;
  workspaceId: string;
  onPatch: (settings: Partial<ViewDetail["settings"]>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{t("inspector.view")}</Badge>
        <span className="truncate text-[12px]">{view.name}</span>
        <CopyReferenceButton
          className="ml-auto"
          reference={{
            type: "view",
            workspaceId,
            targetId: view.id,
            label: view.name,
            viewId: view.id,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("inspector.nothingSelected")}</p>

      <div className="space-y-3 border-t border-border pt-3">
        <Label>{t("inspector.viewSettings")}</Label>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="view-full-titles" className="cursor-pointer text-[12.5px]">
            {t("inspector.showFullTitles")}
          </label>
          <Switch
            id="view-full-titles"
            checked={view.settings.showFullTitles}
            onCheckedChange={(checked) => onPatch({ showFullTitles: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="view-descriptions" className="cursor-pointer text-[12.5px]">
            {t("inspector.showDescriptions")}
          </label>
          <Switch
            id="view-descriptions"
            checked={view.settings.showDescriptions}
            onCheckedChange={(checked) => onPatch({ showDescriptions: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">{t("inspector.showBoundaries")}</span>
          <Switch
            checked={view.settings.showBoundaries}
            onCheckedChange={(checked) => onPatch({ showBoundaries: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">{t("inspector.snapToGrid")}</span>
          <Switch
            checked={view.settings.snapToGrid}
            onCheckedChange={(checked) => onPatch({ snapToGrid: checked })}
          />
        </div>

        <Field label={t("inspector.layoutDirection")}>
          <Select
            value={view.settings.autoLayoutDirection}
            onValueChange={(value) => onPatch({ autoLayoutDirection: value as "LR" | "TB" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LR">Left → Right</SelectItem>
              <SelectItem value="TB">Top → Bottom</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("inspector.layoutAlgorithm")}>
          <Select
            value={view.settings.autoLayoutAlgorithm}
            onValueChange={(value) =>
              onPatch({
                autoLayoutAlgorithm: value as ViewDetail["settings"]["autoLayoutAlgorithm"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["dagre", "force", "radial", "grid"] as const).map((algorithm) => (
                <SelectItem key={algorithm} value={algorithm}>
                  {t(`layoutAlgorithms.${algorithm}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("boundaries.layerLabel")}>
          <Select
            value={view.settings.boundaryLayer}
            onValueChange={(value) =>
              onPatch({ boundaryLayer: value as ViewDetail["settings"]["boundaryLayer"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["deployment", "security", "compliance", "ownership", "custom"] as const).map(
                (layer) => (
                  <SelectItem key={layer} value={layer}>
                    {t(`boundaries.layer.${layer}`)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("inspector.relationshipRouting")}>
          <Select
            value={view.settings.relationshipRouting}
            onValueChange={(value) =>
              onPatch({
                relationshipRouting: value as ViewDetail["settings"]["relationshipRouting"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orthogonal">{t("inspector.routingOrthogonal")}</SelectItem>
              <SelectItem value="curved">{t("inspector.routingCurved")}</SelectItem>
              <SelectItem value="straight">{t("inspector.routingStraight")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">{t("inspector.showRelationshipLabels")}</span>
          <Switch
            checked={view.settings.showRelationshipLabels}
            onCheckedChange={(checked) => onPatch({ showRelationshipLabels: checked })}
          />
        </div>
      </div>
    </div>
  );
}
