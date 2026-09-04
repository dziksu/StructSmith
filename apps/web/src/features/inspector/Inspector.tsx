import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ElementKind,
  ElementRole,
  InteractionStyle,
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
import { useEditorStore } from "@/store/editor";
import { iconFor } from "../icons";
import { PropertyEditor } from "./PropertyEditor";
import { TagEditor } from "./TagEditor";

interface InspectorProps {
  workspaceId: string;
  elements: readonly ArchitectureElement[];
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

export function Inspector({ workspaceId, elements, relationships, records, view }: InspectorProps) {
  const { t } = useTranslation();
  const selection = useEditorStore((state) => state.selection);
  const applyOperations = useApplyOperations(workspaceId);

  const element =
    selection.type === "element" ? elements.find((item) => item.id === selection.id) : undefined;
  const relationship =
    selection.type === "relationship"
      ? relationships.find((item) => item.id === selection.id)
      : undefined;

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
              records={records}
              onPatch={(data, label) =>
                applyOperations.mutate({
                  label,
                  operations: [{ op: "updateElement", elementId: element.id, data }],
                })
              }
            />
          )}

          {relationship && (
            <RelationshipInspector
              key={relationship.id}
              relationship={relationship}
              elements={elements}
              onPatch={(data, label) =>
                applyOperations.mutate({
                  label,
                  operations: [
                    { op: "updateRelationship", relationshipId: relationship.id, data },
                  ],
                })
              }
            />
          )}

          {!element && !relationship && view && (
            <ViewInspector
              key={view.id}
              view={view}
              onPatch={(settings) =>
                applyOperations.mutate({
                  label: t("inspector.viewSettings"),
                  operations: [{ op: "updateView", viewId: view.id, data: { settings } }],
                })
              }
            />
          )}

          {!element && !relationship && !view && (
            <p className="text-xs text-muted-foreground">{t("inspector.nothingSelected")}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------------------------------- element --------------------------------- */

function ElementInspector({
  element,
  elements,
  records,
  onPatch,
}: {
  element: ArchitectureElement;
  elements: readonly ArchitectureElement[];
  records: readonly ArchitectureRecord[];
  onPatch: (data: UpdateElementInput, label: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(element.name);
  const [description, setDescription] = useState(element.description ?? "");
  const [technology, setTechnology] = useState(element.technology ?? "");

  useEffect(() => {
    setName(element.name);
    setDescription(element.description ?? "");
    setTechnology(element.technology ?? "");
  }, [element.id, element.name, element.description, element.technology]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Badge variant="primary">{t("inspector.element")}</Badge>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{element.id}</span>
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

      <div className="flex items-center justify-between">
        <Label>{t("inspector.external")}</Label>
        <Switch
          checked={element.external}
          onCheckedChange={(checked) => onPatch({ external: checked }, "Changed external flag")}
        />
      </div>

      <Field label={t("common.tags")}>
        <TagEditor
          tags={element.tags}
          onChange={(tags) => onPatch({ tags }, "Updated tags")}
        />
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
              <div key={record.id} className="rounded border border-border/60 px-2 py-1 text-[12px]">
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
  onPatch,
}: {
  relationship: ArchitectureRelationship;
  elements: readonly ArchitectureElement[];
  onPatch: (data: UpdateRelationshipInput, label: string) => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState(relationship.description ?? "");
  const [technology, setTechnology] = useState(relationship.technology ?? "");

  useEffect(() => {
    setDescription(relationship.description ?? "");
    setTechnology(relationship.technology ?? "");
  }, [relationship.id, relationship.description, relationship.technology]);

  const debouncedPatch = useDebouncedCallback(
    (data: UpdateRelationshipInput) => onPatch(data, "Updated relationship"),
    600,
  );

  const nameOf = (id: string): string => elements.find((element) => element.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="primary">{t("inspector.relationship")}</Badge>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{relationship.id}</span>
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
        <Input
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
        <TagEditor tags={relationship.tags} onChange={(tags) => onPatch({ tags }, "Updated tags")} />
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
  onPatch,
}: {
  view: ViewDetail;
  onPatch: (settings: Partial<ViewDetail["settings"]>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{t("inspector.view")}</Badge>
        <span className="truncate text-[12px]">{view.name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("inspector.nothingSelected")}</p>

      <div className="space-y-3 border-t border-border pt-3">
        <Label>{t("inspector.viewSettings")}</Label>

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
      </div>
    </div>
  );
}
