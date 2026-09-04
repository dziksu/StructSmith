import type { ViewDetail } from "@structsmith/contracts";
import { presets } from "@structsmith/domain";
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
import { useApplyOperations } from "@/hooks/useApi";
import { useEditorStore } from "@/store/editor";
import { iconFor } from "../icons";

/**
 * Palette presets (spec §31) are shortcuts for a `kind` + `role` pair — the
 * model stays plain.
 */
export function ElementPalette({
  workspaceId,
  view,
}: {
  workspaceId: string;
  view: ViewDetail | null;
}) {
  const { t } = useTranslation();
  const open = useEditorStore((state) => state.paletteOpen);
  const setOpen = useEditorStore((state) => state.setPaletteOpen);
  const select = useEditorStore((state) => state.select);
  const applyOperations = useApplyOperations(workspaceId);

  const add = (preset: (typeof presets)[number]): void => {
    const name = t(`presets.${preset.id}`, { defaultValue: preset.label });
    applyOperations.mutate(
      {
        label: `Added ${name}`,
        operations: [
          {
            op: "createElement",
            ref: "created",
            data: {
              kind: preset.kind,
              role: preset.role,
              name,
              external: preset.external ?? false,
              technology: preset.technology ?? null,
            },
          },
          ...(view
            ? [
                {
                  op: "setViewElements" as const,
                  viewId: view.id,
                  elementIds: ["@created"],
                  mode: "add" as const,
                },
              ]
            : []),
        ],
      },
      {
        onSuccess: (result) => {
          const created = result.appliedOperations.find((operation) => operation.ref === "created");
          if (created?.id) select({ type: "element", id: created.id });
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0" hideClose>
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <Command>
          <CommandInput placeholder={t("palette.title")} />
          <CommandList>
            <CommandEmpty>{t("command.empty")}</CommandEmpty>
            <CommandGroup heading={t("palette.title")}>
              {presets.map((preset) => {
                const Icon = iconFor(preset.kind, preset.role);
                return (
                  <CommandItem
                    key={preset.id}
                    value={`${preset.label} ${preset.kind} ${preset.role ?? ""}`}
                    onSelect={() => add(preset)}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">
                      {t(`presets.${preset.id}`, { defaultValue: preset.label })}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t(`kinds.${preset.kind}`)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {t("palette.hint")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
