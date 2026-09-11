import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { primaryModifierLabel } from "@/lib/platform";
import { useEditorStore } from "@/store/editor";

export function KeyboardShortcutsDialog() {
  const { t } = useTranslation();
  const open = useEditorStore((state) => state.shortcutsOpen);
  const setOpen = useEditorStore((state) => state.setShortcutsOpen);
  const primary = primaryModifierLabel();
  const shortcuts = [
    [t("shortcuts.commandPalette"), `${primary} K`],
    [t("shortcuts.showShortcuts"), `${primary} /`],
    [t("shortcuts.selectAll"), `${primary} A`],
    [t("shortcuts.addToSelection"), `${primary} + ${t("shortcuts.click")}`],
    [t("shortcuts.marqueeSelection"), `${primary} + ${t("shortcuts.dragCanvas")}`],
    [t("shortcuts.copyWithConnections"), `${primary} C`],
    [t("shortcuts.paste"), `${primary} V`],
    [t("shortcuts.delete"), "Delete / Backspace"],
    [t("shortcuts.undo"), `${primary} Z`],
    [t("shortcuts.redo"), `${primary} Shift Z`],
    [t("shortcuts.fitView"), "F"],
    [t("shortcuts.clearSelection"), "Escape"],
    [t("shortcuts.pan"), t("shortcuts.dragCanvas")],
  ] as const;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0" hideClose>
        <DialogTitle className="sr-only">{t("shortcuts.title")}</DialogTitle>
        <Command>
          <CommandInput placeholder={t("shortcuts.search")} />
          <CommandList className="max-h-[420px] p-1">
            <CommandEmpty>{t("shortcuts.empty")}</CommandEmpty>
            {shortcuts.map(([label, keys]) => (
              <CommandItem key={label} value={`${label} ${keys}`} className="cursor-default">
                <span className="flex-1">{label}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {keys}
                </kbd>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
