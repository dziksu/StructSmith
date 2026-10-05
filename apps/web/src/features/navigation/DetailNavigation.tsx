import type { ArchitectureElement, ArchitectureView } from "@structsmith/contracts";
import { detailViewKind, detailViewsFor } from "@structsmith/domain";
import { ArrowDownRight } from "lucide-react";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface DetailNavigation {
  elements: readonly ArchitectureElement[];
  views: readonly ArchitectureView[];
  currentViewId: string | null;
  enabled: boolean;
  openDetails: (elementId: string) => void;
}

export const DetailNavigationContext = createContext<DetailNavigation | null>(null);

export function useDetailNavigation(elementId?: string) {
  const context = useContext(DetailNavigationContext);
  const element = context?.elements.find((item) => item.id === elementId);
  const kind = element ? detailViewKind(element) : null;
  const candidates =
    element && context ? detailViewsFor(element, context.views, context.currentViewId) : [];
  const alreadyInside = context?.views.some(
    (view) =>
      view.id === context.currentViewId && view.scopeElementId === elementId && view.kind === kind,
  );
  return {
    available: Boolean(element && kind && (!alreadyInside || candidates.length > 0)),
    count: candidates.length,
    enabled: context?.enabled ?? false,
    open: () => elementId && context?.openDetails(elementId),
  };
}

export function DetailViewAction({
  elementId,
  compact = false,
}: {
  elementId: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const navigation = useDetailNavigation(elementId);
  if (!navigation.available) return null;
  const label = t("navigation.openDetails");
  return (
    <Button
      type="button"
      size={compact ? "iconSm" : "sm"}
      variant={compact ? "ghost" : "outline"}
      className="nodrag nopan shrink-0 normal-case tracking-normal"
      aria-label={label}
      title={
        navigation.count > 0
          ? t("navigation.openHint", { count: navigation.count })
          : t("navigation.createHint")
      }
      disabled={!navigation.enabled}
      onClick={(event) => {
        event.stopPropagation();
        navigation.open();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <ArrowDownRight className="h-3.5 w-3.5" />
      {!compact && label}
    </Button>
  );
}
