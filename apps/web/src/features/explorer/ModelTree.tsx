import type { ArchitectureBoundary, ArchitectureElement, ViewDetail } from "@structsmith/contracts";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Library,
  Plus,
  SquareDashed,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";
import { useApplyOperations } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { DRAG_MIME } from "../canvas/Canvas";
import { iconFor } from "../icons";
import { CopyReferenceButton } from "../reference/CopyReferenceButton";

interface ModelTreeProps {
  workspaceId: string;
  elements: readonly ArchitectureElement[];
  boundaries: readonly ArchitectureBoundary[];
  view: ViewDetail | null;
}

interface Group {
  key: string;
  label: string;
  elements: ArchitectureElement[];
}

/** The explorer deliberately separates reusable model elements from one view's structure. */
export function ModelTree({ workspaceId, elements, boundaries, view }: ModelTreeProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selection = useEditorStore((state) => state.selection);
  const select = useEditorStore((state) => state.select);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const openElementPalette = useEditorStore((state) => state.openElementPalette);
  const applyOperations = useApplyOperations(workspaceId);

  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element] as const)),
    [elements],
  );
  const viewElementIds = useMemo(
    () => new Set((view?.elements ?? []).map((entry) => entry.elementId)),
    [view],
  );
  const visibleOnCanvas = useMemo(
    () =>
      new Set(
        (view?.elements ?? []).filter((entry) => !entry.hidden).map((entry) => entry.elementId),
      ),
    [view],
  );
  const activeBoundaries = boundaries.filter(
    (boundary) => boundary.layer === (view?.settings.boundaryLayer ?? "deployment"),
  );
  const boundaryByElement = new Map(
    activeBoundaries.flatMap((boundary) =>
      boundary.elementIds.map((elementId) => [elementId, boundary] as const),
    ),
  );
  const assignedToBoundary = new Set(boundaryByElement.keys());

  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return null;
    return new Set(
      elements
        .filter((element) =>
          [element.name, element.technology, element.role, element.kind]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle)),
        )
        .map((element) => element.id),
    );
  }, [elements, filter]);

  const childrenOf = (parentId: string): ArchitectureElement[] =>
    elements.filter((element) => element.parentId === parentId);

  const isVisible = (element: ArchitectureElement): boolean => {
    if (!matches || matches.has(element.id)) return true;
    return childrenOf(element.id).some(isVisible);
  };

  const modelRoots = elements.filter((element) => !element.parentId);
  const groups: Group[] = [
    {
      key: "people",
      label: t("explorer.people"),
      elements: modelRoots.filter((element) => element.kind === "person"),
    },
    {
      key: "systems",
      label: t("explorer.systems"),
      elements: modelRoots.filter(
        (element) => element.kind === "softwareSystem" && !element.external,
      ),
    },
    {
      key: "external",
      label: t("explorer.externalSystems"),
      elements: modelRoots.filter((element) => element.external && element.kind !== "person"),
    },
    {
      key: "deployment",
      label: t("explorer.deployment"),
      elements: modelRoots.filter(
        (element) => element.kind === "deploymentNode" || element.kind === "infrastructureNode",
      ),
    },
  ];
  const grouped = new Set(groups.flatMap((group) => group.elements.map((element) => element.id)));
  groups.push({
    key: "other",
    label: t("explorer.other"),
    elements: modelRoots.filter((element) => !grouped.has(element.id)),
  });

  const mutateMembership = (elementId: string, boundaryId: string | null): void => {
    if (!view) return;
    const currentBoundary = boundaryByElement.get(elementId);
    applyOperations.mutate({
      label: boundaryId ? t("boundaries.membershipChanged") : t("explorer.addToView"),
      operations: [
        { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "add" },
        { op: "setLayout", viewId: view.id, entries: [{ elementId, hidden: false }] },
        ...(boundaryId
          ? [
              {
                op: "setBoundaryMembers" as const,
                boundaryId,
                elementIds: [elementId],
                mode: "add" as const,
              },
            ]
          : currentBoundary
            ? [
                {
                  op: "setBoundaryMembers" as const,
                  boundaryId: currentBoundary.id,
                  elementIds: [elementId],
                  mode: "remove" as const,
                },
              ]
            : []),
      ],
    });
  };

  const removeFromView = (elementId: string): void => {
    if (!view) return;
    applyOperations.mutate({
      label: t("explorer.removeFromView"),
      operations: [
        { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "remove" },
      ],
    });
  };

  const deleteFromModel = (element: ArchitectureElement): void =>
    applyOperations.mutate({
      label: `Deleted ${element.name}`,
      operations: [{ op: "deleteElement", elementId: element.id, cascade: true }],
    });

  const createBoundary = (): void => {
    if (!view) return;
    applyOperations.mutate({
      label: t("boundaries.created"),
      operations: [
        {
          op: "createBoundary",
          data: {
            viewId: view.id,
            name: t("boundaries.newName"),
            kind: "networkZone",
            layer: view.settings.boundaryLayer,
          },
        },
      ],
    });
  };

  const startElementDrag = (event: React.DragEvent, elementId: string): void => {
    event.dataTransfer.setData(DRAG_MIME, elementId);
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const renderViewElement = (
    element: ArchitectureElement,
    depth: number,
    allowedIds?: ReadonlySet<string>,
  ) => {
    if (!isVisible(element)) return null;
    const children = childrenOf(element.id).filter((child) =>
      allowedIds
        ? allowedIds.has(child.id)
        : viewElementIds.has(child.id) && !assignedToBoundary.has(child.id),
    );
    const collapseKey = `view-element:${element.id}`;
    const isCollapsed = collapsed[collapseKey] ?? false;
    const active = selection.type === "element" && selection.id === element.id;
    const Icon = iconFor(element.kind, element.role);

    return (
      <div key={element.id}>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => startElementDrag(event, element.id)}
          onClick={() => {
            select({ type: "element", id: element.id });
            if (visibleOnCanvas.has(element.id)) requestFocus(element.id);
          }}
          onKeyDown={(event) =>
            event.key === "Enter" && select({ type: "element", id: element.id })
          }
          className={cn(
            "group flex h-6 cursor-pointer items-center gap-1.5 rounded pr-1 text-[12.5px] transition-colors hover:bg-accent",
            active && "bg-accent text-accent-foreground",
            !visibleOnCanvas.has(element.id) && "text-muted-foreground",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed((current) => ({ ...current, [collapseKey]: !isCollapsed }));
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              element.external ? "text-ownership-external" : "text-ownership-internal",
            )}
          />
          <span className="flex-1 truncate">{element.name}</span>
          <Tooltip label={t("explorer.removeFromView")}>
            <button
              type="button"
              className="hidden rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
              onClick={(event) => {
                event.stopPropagation();
                removeFromView(element.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Tooltip>
        </div>
        {!isCollapsed && children.map((child) => renderViewElement(child, depth + 1, allowedIds))}
      </div>
    );
  };

  const renderBoundary = (boundary: ArchitectureBoundary, depth: number) => {
    const children = activeBoundaries.filter(
      (candidate) => candidate.parentBoundaryId === boundary.id,
    );
    const memberIds = new Set(boundary.elementIds);
    const members = boundary.elementIds
      .map((id) => elementsById.get(id))
      .filter((element): element is ArchitectureElement => Boolean(element))
      .filter((element) => !element.parentId || !memberIds.has(element.parentId));
    const active = selection.type === "boundary" && selection.id === boundary.id;
    const collapseKey = `boundary:${boundary.id}`;
    const isCollapsed = collapsed[collapseKey] ?? false;

    return (
      <div key={boundary.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => select({ type: "boundary", id: boundary.id })}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(DRAG_MIME)) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const elementId = event.dataTransfer.getData(DRAG_MIME);
            if (elementId) mutateMembership(elementId, boundary.id);
          }}
          onKeyDown={(event) =>
            event.key === "Enter" && select({ type: "boundary", id: boundary.id })
          }
          className={cn(
            "group flex h-7 cursor-pointer items-center gap-1.5 rounded border border-transparent pr-1 text-[12.5px] hover:border-border hover:bg-accent",
            active && "border-primary/40 bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {children.length > 0 || members.length > 0 ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed((current) => ({ ...current, [collapseKey]: !isCollapsed }));
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <SquareDashed className="h-3.5 w-3.5 text-primary" />
          <span className="flex-1 truncate font-medium">{boundary.name}</span>
          <span className="text-[9px] tabular-nums text-muted-foreground">
            {boundary.elementIds.length}
          </span>
          <span className="hidden items-center group-hover:flex">
            <Tooltip label={t("boundaries.addMember")}>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  openElementPalette(boundary.id);
                }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </Tooltip>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                applyOperations.mutate({
                  label: t("boundaries.deleted"),
                  operations: [{ op: "deleteBoundary", boundaryId: boundary.id, cascade: false }],
                });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        </div>
        {!isCollapsed && children.map((child) => renderBoundary(child, depth + 1))}
        {!isCollapsed && members.map((member) => renderViewElement(member, depth + 1, memberIds))}
      </div>
    );
  };

  const renderLibraryElement = (element: ArchitectureElement, depth: number) => {
    if (!isVisible(element)) return null;
    const children = childrenOf(element.id);
    const collapseKey = `library:${element.id}`;
    const isCollapsed = collapsed[collapseKey] ?? false;
    const active = selection.type === "element" && selection.id === element.id;
    const inView = viewElementIds.has(element.id);
    const Icon = iconFor(element.kind, element.role);

    return (
      <div key={element.id}>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => startElementDrag(event, element.id)}
          onClick={() => {
            select({ type: "element", id: element.id });
            if (visibleOnCanvas.has(element.id)) requestFocus(element.id);
          }}
          onKeyDown={(event) =>
            event.key === "Enter" && select({ type: "element", id: element.id })
          }
          className={cn(
            "group flex h-6 cursor-pointer items-center gap-1.5 rounded pr-1 text-[12.5px] transition-colors hover:bg-accent",
            active && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed((current) => ({ ...current, [collapseKey]: !isCollapsed }));
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              element.external ? "text-ownership-external" : "text-ownership-internal",
            )}
          />
          <span className="flex-1 truncate">{element.name}</span>
          {inView && <Check className="h-3 w-3 text-primary" />}
          <span className="hidden items-center gap-0.5 group-hover:flex">
            <CopyReferenceButton
              reference={{
                type: "element",
                workspaceId,
                targetId: element.id,
                label: element.name,
                viewId: view?.id,
              }}
            />
            {view && !inView && (
              <Tooltip label={t("explorer.addToView")}>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    mutateMembership(element.id, null);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </Tooltip>
            )}
            <Tooltip label={t("contextMenu.deleteFromModel")}>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteFromModel(element);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Tooltip>
          </span>
        </div>
        {!isCollapsed && children.map((child) => renderLibraryElement(child, depth + 1))}
      </div>
    );
  };

  const unassignedRoots = elements.filter(
    (element) =>
      viewElementIds.has(element.id) &&
      !assignedToBoundary.has(element.id) &&
      (!element.parentId ||
        !viewElementIds.has(element.parentId) ||
        assignedToBoundary.has(element.parentId)),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("explorer.filter")}
          className="h-7"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1 pb-6">
          <section
            className="mb-3 overflow-hidden rounded-md border border-border bg-card/35"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(DRAG_MIME)) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const elementId = event.dataTransfer.getData(DRAG_MIME);
              if (elementId) mutateMembership(elementId, null);
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5">
              <FolderTree className="h-3.5 w-3.5 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider">
                  {t("explorer.viewStructure")}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {view?.name ?? t("explorer.emptyViews")}
                </div>
              </div>
              {view && (
                <>
                  <Tooltip label={t("explorer.addElement")}>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => openElementPalette()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip label={t("boundaries.add")}>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={createBoundary}
                    >
                      <SquareDashed className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
            <div className="min-h-12 p-1">
              {!view && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {t("explorer.emptyViews")}
                </p>
              )}
              {view && activeBoundaries.length === 0 && unassignedRoots.length === 0 && (
                <p className="px-2 py-3 text-[11px] text-muted-foreground">
                  {t("explorer.viewStructureEmpty")}
                </p>
              )}
              {activeBoundaries
                .filter((boundary) => !boundary.parentBoundaryId)
                .map((boundary) => renderBoundary(boundary, 0))}
              {unassignedRoots.length > 0 && (
                <div className="mt-1 border-t border-border/70 pt-1">
                  <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("explorer.unassigned")}
                  </div>
                  {unassignedRoots.map((element) => renderViewElement(element, 0))}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Library className="h-3.5 w-3.5" />
              <span>{t("explorer.elementLibrary")}</span>
              <span className="ml-auto text-[9px] font-normal tabular-nums">{elements.length}</span>
            </div>
            {elements.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">{t("explorer.emptyModel")}</p>
            )}
            {groups
              .filter((group) => group.elements.some(isVisible))
              .map((group) => (
                <div key={group.key} className="mb-1">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground",
                      group.key === "systems" && "text-ownership-internal",
                      group.key === "external" && "text-ownership-external",
                    )}
                  >
                    {group.label}
                  </div>
                  {group.elements.map((element) => renderLibraryElement(element, 0))}
                </div>
              ))}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
