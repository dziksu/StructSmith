import type { ArchitectureElement, ArchitectureView } from "@structsmith/contracts";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ViewLocation } from "./history";

export function ViewNavigationBar({
  current,
  elements,
  views,
  back,
  onBack,
}: {
  current: ArchitectureView | null;
  elements: readonly ArchitectureElement[];
  views: readonly ArchitectureView[];
  back: readonly ViewLocation[];
  onBack: (index: number) => void;
}) {
  const { t } = useTranslation();
  const trail = back.flatMap((entry, index) => {
    const view = views.find((item) => item.id === entry.viewId);
    return view ? [{ view, index }] : [];
  });
  const scope: string[] = [];
  const seen = new Set<string>();
  let parent = elements.find((element) => element.id === current?.scopeElementId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    scope.unshift(parent.name);
    const parentId = parent.parentId;
    parent = elements.find((element) => element.id === parentId);
  }
  const previous = trail.at(-1);
  return (
    <nav
      aria-label={t("navigation.title")}
      className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-2"
    >
      <Button
        size="sm"
        variant="ghost"
        disabled={!previous}
        onClick={() => previous && onBack(previous.index)}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("navigation.back")}
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
        {trail.map(({ view, index }) => (
          <span key={`${view.id}-${index}`} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="max-w-40 truncate rounded px-1 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onBack(index)}
              title={view.name}
            >
              {view.name}
            </button>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </span>
        ))}
        <span aria-current="page" className="shrink-0 font-medium">
          {current?.name}
        </span>
      </div>
      {scope.length > 0 && (
        <span
          className="max-w-[35%] truncate text-[11px] text-muted-foreground"
          title={scope.join(" / ")}
        >
          {scope.join(" / ")}
        </span>
      )}
    </nav>
  );
}
