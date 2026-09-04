import type { ArchitectureElement, ViewDetail } from "@structsmith/contracts";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";
import { useApplyOperations } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { DRAG_MIME } from "../canvas/Canvas";
import { iconFor } from "../icons";

interface ModelTreeProps {
  workspaceId: string;
  elements: readonly ArchitectureElement[];
  view: ViewDetail | null;
}

interface Group {
  key: string;
  label: string;
  elements: ArchitectureElement[];
}

export function ModelTree({ workspaceId, elements, view }: ModelTreeProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selection = useEditorStore((state) => state.selection);
  const select = useEditorStore((state) => state.select);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const setPaletteOpen = useEditorStore((state) => state.setPaletteOpen);
  const applyOperations = useApplyOperations(workspaceId);

  const onView = useMemo(
    () =>
      new Set(
        (view?.elements ?? []).filter((entry) => !entry.hidden).map((entry) => entry.elementId),
      ),
    [view],
  );

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

  const roots = elements.filter((element) => !element.parentId);
  const groups: Group[] = [
    {
      key: "people",
      label: t("explorer.people"),
      elements: roots.filter((e) => e.kind === "person"),
    },
    {
      key: "systems",
      label: t("explorer.systems"),
      elements: roots.filter((e) => e.kind === "softwareSystem" && !e.external),
    },
    {
      key: "external",
      label: t("explorer.externalSystems"),
      elements: roots.filter((e) => e.external && e.kind !== "person"),
    },
    {
      key: "deployment",
      label: t("explorer.deployment"),
      elements: roots.filter((e) => e.kind === "deploymentNode" || e.kind === "infrastructureNode"),
    },
  ];
  const grouped = new Set(groups.flatMap((group) => group.elements.map((element) => element.id)));
  groups.push({
    key: "other",
    label: t("explorer.other"),
    elements: roots.filter((element) => !grouped.has(element.id)),
  });

  const childrenOf = (parentId: string): ArchitectureElement[] =>
    elements.filter((element) => element.parentId === parentId);

  const isVisible = (element: ArchitectureElement): boolean => {
    if (!matches) return true;
    if (matches.has(element.id)) return true;
    return childrenOf(element.id).some(isVisible);
  };

  const addToView = (elementId: string): void => {
    if (!view) return;
    applyOperations.mutate({
      label: t("explorer.addToView"),
      operations: [
        { op: "setViewElements", viewId: view.id, elementIds: [elementId], mode: "add" },
        { op: "setLayout", viewId: view.id, entries: [{ elementId, hidden: false }] },
      ],
    });
  };

  const removeElement = (element: ArchitectureElement): void =>
    applyOperations.mutate({
      label: `Deleted ${element.name}`,
      operations: [{ op: "deleteElement", elementId: element.id, cascade: true }],
    });

  const renderElement = (element: ArchitectureElement, depth: number) => {
    if (!isVisible(element)) return null;
    const children = childrenOf(element.id);
    const isCollapsed = collapsed[element.id] ?? false;
    const Icon = iconFor(element.kind, element.role);
    const active = selection.type === "element" && selection.id === element.id;

    return (
      <div key={element.id}>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_MIME, element.id);
            event.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => {
            select({ type: "element", id: element.id });
            if (onView.has(element.id)) requestFocus(element.id);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") select({ type: "element", id: element.id });
          }}
          className={cn(
            "group flex h-6 cursor-pointer items-center gap-1.5 rounded pr-1 text-[12.5px] transition-colors hover:bg-accent",
            active && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed((current) => ({ ...current, [element.id]: !isCollapsed }));
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

          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn("flex-1 truncate", !onView.has(element.id) && "text-muted-foreground")}
          >
            {element.name}
          </span>

          <span className="hidden items-center gap-0.5 group-hover:flex">
            {view && !onView.has(element.id) && (
              <Tooltip label={t("explorer.addToView")}>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    addToView(element.id);
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
                  removeElement(element);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Tooltip>
          </span>
        </div>

        {!isCollapsed && children.map((child) => renderElement(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("explorer.filter")}
          className="h-7"
        />
        <Tooltip label={t("palette.title")}>
          <Button size="iconSm" variant="secondary" onClick={() => setPaletteOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1 pb-6">
          {elements.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t("explorer.emptyModel")}</p>
          )}
          {groups
            .filter((group) => group.elements.some(isVisible))
            .map((group) => (
              <div key={group.key} className="mb-1">
                <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {group.elements.map((element) => renderElement(element, 0))}
              </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
