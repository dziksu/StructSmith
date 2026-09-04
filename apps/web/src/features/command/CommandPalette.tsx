import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureRelationship,
  ArchitectureView,
} from "@structsmith/contracts";
import { Layers, Link2, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEditorStore } from "@/store/editor";
import { iconFor } from "../icons";

interface CommandPaletteProps {
  elements: readonly ArchitectureElement[];
  relationships: readonly ArchitectureRelationship[];
  views: readonly ArchitectureView[];
  records: readonly ArchitectureRecord[];
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
  viewContains: (elementId: string) => boolean;
  findViewWith: (elementId: string) => string | null;
}

/** Global search (spec §38): jump to anything, switching view when needed. */
export function CommandPalette({
  elements,
  relationships,
  views,
  records,
  activeViewId,
  onSelectView,
  viewContains,
  findViewWith,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const open = useEditorStore((state) => state.commandOpen);
  const setOpen = useEditorStore((state) => state.setCommandOpen);
  const select = useEditorStore((state) => state.select);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const setExplorerTab = useEditorStore((state) => state.setExplorerTab);

  const goToElement = (elementId: string): void => {
    select({ type: "element", id: elementId });
    if (!viewContains(elementId)) {
      const target = findViewWith(elementId);
      if (target && target !== activeViewId) onSelectView(target);
    }
    requestFocus(elementId);
    setOpen(false);
  };

  const nameOf = (id: string): string => elements.find((element) => element.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0" hideClose>
        <DialogTitle className="sr-only">{t("common.search")}</DialogTitle>
        <Command>
          <CommandInput placeholder={t("command.placeholder")} />
          <CommandList>
            <CommandEmpty>{t("command.empty")}</CommandEmpty>

            <CommandGroup heading={t("command.elements")}>
              {elements.map((element) => {
                const Icon = iconFor(element.kind, element.role);
                return (
                  <CommandItem
                    key={element.id}
                    value={`element ${element.name} ${element.technology ?? ""} ${element.id}`}
                    onSelect={() => goToElement(element.id)}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{element.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`kinds.${element.kind}`)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandGroup heading={t("command.views")}>
              {views.map((view) => (
                <CommandItem
                  key={view.id}
                  value={`view ${view.name} ${view.key}`}
                  onSelect={() => {
                    onSelectView(view.id);
                    setOpen(false);
                  }}
                >
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{view.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(`viewKinds.${view.kind}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={t("command.relationships")}>
              {relationships.map((relationship) => (
                <CommandItem
                  key={relationship.id}
                  value={`relationship ${nameOf(relationship.sourceElementId)} ${nameOf(
                    relationship.targetElementId,
                  )} ${relationship.description ?? ""}`}
                  onSelect={() => {
                    select({ type: "relationship", id: relationship.id });
                    setOpen(false);
                  }}
                >
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {nameOf(relationship.sourceElementId)} → {nameOf(relationship.targetElementId)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={t("command.records")}>
              {records.map((record) => (
                <CommandItem
                  key={record.id}
                  value={`record ${record.title} ${record.kind}`}
                  onSelect={() => {
                    setExplorerTab("presales");
                    select({ type: "record", id: record.id });
                    setOpen(false);
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{record.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(`presales.kinds.${record.kind}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
